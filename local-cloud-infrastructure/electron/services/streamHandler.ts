import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { encrypt } from './cryptoEngine';
import { logStreamEvent } from '../database/queries';
import { getCurrentStoragePath } from './storageManager';

interface StreamSession {
  cameraId: string;
  sessionId: string;
  startedAt: number;
  outputDir: string;
  writeStream: fs.WriteStream | null;
  bytesWritten: number;
}

export interface StreamResult {
  success: boolean;
  sessionId?: string;
  error?: string;
}

const activeSessions = new Map<string, StreamSession>();

export async function startStream(cameraId: string): Promise<StreamResult> {
  if (activeSessions.has(cameraId)) {
    return { success: true, sessionId: activeSessions.get(cameraId)!.sessionId };
  }

  try {
    const sessionId = crypto.randomUUID();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseStreamDir = path.join(getCurrentStoragePath(), 'streams');
    const outputDir = path.join(baseStreamDir, cameraId);

    await fs.promises.mkdir(outputDir, { recursive: true });

    const chunkPath = path.join(outputDir, `${timestamp}.enc`);
    const writeStream = fs.createWriteStream(chunkPath, { flags: 'a' });

    const session: StreamSession = {
      cameraId,
      sessionId,
      startedAt: Date.now(),
      outputDir,
      writeStream,
      bytesWritten: 0,
    };

    activeSessions.set(cameraId, session);

    await logStreamEvent({ cameraId, sessionId, event: 'start', bytesWritten: 0 });

    console.log(`[streamHandler] Stream started: cameraId=${cameraId} session=${sessionId}`);
    return { success: true, sessionId };
  } catch (err: any) {
    console.error('[streamHandler] startStream error:', err);
    return { success: false, error: err.message };
  }
}

export async function saveChunkEncrypted(raw: Buffer): Promise<{ success: boolean; fileId: string }> {
  const session = [...activeSessions.values()][0];
  if (!session || !session.writeStream) {
    throw new Error('[streamHandler] No active stream session');
  }

  const encrypted = encrypt(raw);
  const fileId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    session.writeStream!.write(encrypted, (err) => {
      if (err) {
        reject(err);
        return;
      }
      session.bytesWritten += encrypted.length;
      resolve({ success: true, fileId });
    });
  });
}


export async function stopStream(cameraId: string): Promise<StreamResult> {
  const session = activeSessions.get(cameraId);
  if (!session) {
    return { success: true }; // already stopped
  }

  try {
    await new Promise<void>((resolve, reject) => {
      if (!session.writeStream) {
        resolve();
        return;
      }
      session.writeStream.end((err: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const duration = Math.round((Date.now() - session.startedAt) / 1000);
    await logStreamEvent({
      cameraId,
      sessionId: session.sessionId,
      event: 'stop',
      bytesWritten: session.bytesWritten,
      durationSeconds: duration,
    });

    activeSessions.delete(cameraId);

    console.log(`[streamHandler] Stream stopped: cameraId=${cameraId} bytes=${session.bytesWritten}`);
    return { success: true, sessionId: session.sessionId };
  } catch (err: any) {
    console.error('[streamHandler] stopStream error:', err);
    return { success: false, error: err.message };
  }
}
