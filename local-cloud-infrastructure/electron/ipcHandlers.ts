import { ipcMain, IpcMainInvokeEvent, dialog } from "electron";
import fs from "fs";
import {
  getStorageStatus,
  updateAllocation,
  selectFolder,
} from "./services/storageManager";
import { saveChunkEncrypted } from "./services/streamHandler";
import { startStream, stopStream } from "./services/streamHandler";
import { runBackup, getBackupStatus } from "./services/storageManager";
import { createSession, validatePin } from "./services/authService";
import {
  getChatbotStatus,
  sendChatMessage,
  getChatHistory,
  createNewSession,
  updateChatbotConfig,
  pickAndAddContextFile,
  listContextFiles,
  addContextFile,
  addContextDirectory,
  removeContextFile,
  startDockerOllama,
  stopDockerOllama,
  pullDockerModel,
  addContextDockerFiles,
} from "./services/chatbotService";
import {
  listFiles,
  uploadFile,
  deleteFile,
  getFilePath,
} from "./services/fileManager";
import {
  hasVaultPassword,
  setVaultPassword,
  checkVaultPassword,
  listSurveillanceFiles,
  saveSurveillanceFile,
  decryptSurveillanceFile,
  deleteSurveillanceFile,
} from "./services/vaultService";
import {
  checkWireGuardInstalled,
  initServer,
  addPeer,
  listPeers,
  removePeer,
  getServerMeta,
  startTunnel,
  stopTunnel,
  getTunnelStatus,
  getPeerClientConf,
} from "./services/wireguardManager";

// Session store — declared here so all handlers can reference it
export const sessionStore = new Map<
  string,
  { createdAt: number; expiresAt: number }
>();

export function registerIpcHandlers(): void {
  ipcMain.handle("req-storage-status", async (_event: IpcMainInvokeEvent) => {
    try {
      return await getStorageStatus();
    } catch (err) {
      console.error("[ipc] req-storage-status error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-save-chunk",
    async (_event: IpcMainInvokeEvent, buffer: ArrayBuffer) => {
      try {
        if (!(buffer instanceof ArrayBuffer)) {
          throw new TypeError("req-save-chunk: payload must be ArrayBuffer");
        }
        return await saveChunkEncrypted(Buffer.from(buffer));
      } catch (err) {
        console.error("[ipc] req-save-chunk error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-update-allocation",
    async (_event: IpcMainInvokeEvent, bytes: number) => {
      try {
        if (typeof bytes !== "number" || bytes < 0) {
          throw new TypeError(
            "req-update-allocation: bytes must be positive number",
          );
        }
        return await updateAllocation(bytes);
      } catch (err) {
        console.error("[ipc] req-update-allocation error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-select-folder", async (_event: IpcMainInvokeEvent) => {
    try {
      return await selectFolder();
    } catch (err) {
      console.error("[ipc] req-select-folder error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-start-stream",
    async (_event: IpcMainInvokeEvent, { cameraId }: { cameraId: string }) => {
      try {
        if (typeof cameraId !== "string" || !cameraId.trim()) {
          throw new TypeError(
            "req-start-stream: cameraId must be non-empty string",
          );
        }
        return await startStream(cameraId);
      } catch (err) {
        console.error("[ipc] req-start-stream error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-stop-stream",
    async (_event: IpcMainInvokeEvent, { cameraId }: { cameraId: string }) => {
      try {
        return await stopStream(cameraId);
      } catch (err) {
        console.error("[ipc] req-stop-stream error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-run-backup", async (_event: IpcMainInvokeEvent) => {
    try {
      return await runBackup();
    } catch (err) {
      console.error("[ipc] req-run-backup error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-backup-status",
    async (_event: IpcMainInvokeEvent, { jobId }: { jobId: string }) => {
      try {
        if (typeof jobId !== "string")
          throw new TypeError("req-backup-status: jobId required");
        return await getBackupStatus(jobId);
      } catch (err) {
        console.error("[ipc] req-backup-status error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-login",
    async (_event: IpcMainInvokeEvent, { pin }: { pin: string }) => {
      try {
        if (typeof pin !== "string" || pin.length < 4) {
          return { success: false, error: "PIN must be at least 4 characters" };
        }
        return await createSession(pin);
      } catch (err) {
        console.error("[ipc] req-login error:", err);
        return { success: false, error: "Authentication failed" };
      }
    },
  );

  ipcMain.handle("req-chatbot-status", async () => {
    try {
      return await getChatbotStatus();
    } catch (err) {
      console.error("[ipc] req-chatbot-status error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-chatbot-send",
    async (
      _event: IpcMainInvokeEvent,
      {
        message,
        sessionId,
        useContext,
      }: { message: string; sessionId?: string; useContext?: boolean },
    ) => {
      try {
        if (typeof message !== "string" || !message.trim()) {
          throw new TypeError("req-chatbot-send: message required");
        }
        return await sendChatMessage(message, sessionId, useContext !== false);
      } catch (err) {
        console.error("[ipc] req-chatbot-send error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-chatbot-history",
    async (
      _event: IpcMainInvokeEvent,
      { sessionId }: { sessionId: string },
    ) => {
      try {
        if (typeof sessionId !== "string")
          throw new TypeError("sessionId required");
        return getChatHistory(sessionId);
      } catch (err) {
        console.error("[ipc] req-chatbot-history error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-chatbot-new-session", async () => {
    try {
      return createNewSession();
    } catch (err) {
      console.error("[ipc] req-chatbot-new-session error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-chatbot-config",
    async (
      _event: IpcMainInvokeEvent,
      updates: { ollamaUrl?: string; model?: string },
    ) => {
      try {
        return updateChatbotConfig(updates || {});
      } catch (err) {
        console.error("[ipc] req-chatbot-config error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-chatbot-context-list", async () => {
    try {
      return listContextFiles();
    } catch (err) {
      console.error("[ipc] req-chatbot-context-list error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-chatbot-context-add",
    async (
      _event: IpcMainInvokeEvent,
      { relativePath }: { relativePath?: string },
    ) => {
      try {
        if (relativePath) {
          return addContextFile(relativePath);
        }
        return await pickAndAddContextFile();
      } catch (err) {
        console.error("[ipc] req-chatbot-context-add error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-chatbot-context-add-dir",
    async (
      _event: IpcMainInvokeEvent,
      { relativeDir }: { relativeDir: string },
    ) => {
      try {
        if (typeof relativeDir !== "string")
          throw new TypeError("relativeDir required");
        return addContextDirectory(relativeDir);
      } catch (err) {
        console.error("[ipc] req-chatbot-context-add-dir error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-chatbot-context-remove",
    async (_event: IpcMainInvokeEvent, { fileId }: { fileId: string }) => {
      try {
        if (typeof fileId !== "string") throw new TypeError("fileId required");
        return { success: removeContextFile(fileId) };
      } catch (err) {
        console.error("[ipc] req-chatbot-context-remove error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-chatbot-context-docker", async () => {
    try {
      return addContextDockerFiles();
    } catch (err) {
      console.error("[ipc] req-chatbot-context-docker error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-docker-start",
    async (_event: IpcMainInvokeEvent, { profile }: { profile?: string }) => {
      try {
        const valid = ["cpu", "nvidia", "amd"];
        const p = valid.includes(profile || "")
          ? (profile as "cpu" | "nvidia" | "amd")
          : "cpu";
        return await startDockerOllama(p);
      } catch (err) {
        console.error("[ipc] req-docker-start error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-docker-stop", async () => {
    try {
      return await stopDockerOllama();
    } catch (err) {
      console.error("[ipc] req-docker-stop error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-docker-pull-model",
    async (_event: IpcMainInvokeEvent, { model }: { model: string }) => {
      try {
        if (typeof model !== "string" || !model.trim())
          throw new TypeError("model required");
        await pullDockerModel(model);
        return { success: true };
      } catch (err) {
        console.error("[ipc] req-docker-pull-model error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle("req-list-files", async () => {
    try {
      return await listFiles();
    } catch (err) {
      console.error("[ipc] req-list-files error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-upload-file",
    async (
      _event: IpcMainInvokeEvent,
      { buffer, fileName }: { buffer: ArrayBuffer; fileName: string },
    ) => {
      try {
        if (!(buffer instanceof ArrayBuffer)) {
          throw new TypeError("req-upload-file: buffer must be ArrayBuffer");
        }
        if (typeof fileName !== "string" || !fileName.trim()) {
          throw new TypeError("req-upload-file: fileName required");
        }
        return await uploadFile(Buffer.from(buffer), fileName);
      } catch (err) {
        console.error("[ipc] req-upload-file error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-delete-file",
    async (_event: IpcMainInvokeEvent, { fileId }: { fileId: string }) => {
      try {
        if (typeof fileId !== "string") throw new TypeError("fileId required");
        return await deleteFile(fileId);
      } catch (err) {
        console.error("[ipc] req-delete-file error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-download-file",
    async (_event: IpcMainInvokeEvent, { filePath }: { filePath: string }) => {
      try {
        if (typeof filePath !== "string")
          throw new TypeError("filePath required");
        const localPath = await getFilePath(filePath);
        if (!localPath) {
          throw new Error("File not found");
        }
        return { path: localPath };
      } catch (err) {
        console.error("[ipc] req-download-file error:", err);
        throw err;
      }
    },
  );

  ipcMain.handle(
    "req-logout",
    async (_event: IpcMainInvokeEvent, { token }: { token: string }) => {
      try {
        if (typeof token !== "string") return { success: false, error: "token required" };
        sessionStore.delete(token);
        return { success: true };
      } catch (err) {
        console.error("[ipc] req-logout error:", err);
        return { success: false };
      }
    },
  );

  // ── Surveillance Vault ────────────────────────────────────────────────────

  ipcMain.handle("req-vault-status", async () => {
    try {
      return { hasPassword: hasVaultPassword() };
    } catch (err) {
      console.error("[ipc] req-vault-status error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-vault-set-password",
    async (
      _event: IpcMainInvokeEvent,
      { newPassword, currentPassword }: { newPassword: string; currentPassword?: string },
    ) => {
      try {
        if (typeof newPassword !== "string" || newPassword.length < 6)
          return { success: false, error: "Password must be at least 6 characters." };
        return setVaultPassword(newPassword, currentPassword);
      } catch (err) {
        console.error("[ipc] req-vault-set-password error:", err);
        return { success: false, error: "Failed to set password." };
      }
    },
  );

  ipcMain.handle(
    "req-vault-verify",
    async (_event: IpcMainInvokeEvent, { password }: { password: string }) => {
      try {
        if (typeof password !== "string") return { valid: false, error: "Password required." };
        return checkVaultPassword(password);
      } catch (err) {
        console.error("[ipc] req-vault-verify error:", err);
        return { valid: false, error: "Verification failed." };
      }
    },
  );

  ipcMain.handle("req-vault-list", async () => {
    try {
      return listSurveillanceFiles();
    } catch (err) {
      console.error("[ipc] req-vault-list error:", err);
      throw err;
    }
  });

  ipcMain.handle(
    "req-vault-upload",
    async (
      _event: IpcMainInvokeEvent,
      { buffer, fileName }: { buffer: ArrayBuffer; fileName: string },
    ) => {
      try {
        if (!(buffer instanceof ArrayBuffer))
          return { success: false, error: "Buffer required." };
        if (typeof fileName !== "string" || !fileName.trim())
          return { success: false, error: "fileName required." };
        return saveSurveillanceFile(fileName, Buffer.from(buffer));
      } catch (err) {
        console.error("[ipc] req-vault-upload error:", err);
        return { success: false, error: String(err) };
      }
    },
  );

  ipcMain.handle(
    "req-vault-decrypt",
    async (
      _event: IpcMainInvokeEvent,
      { id, password }: { id: string; password: string },
    ) => {
      try {
        if (typeof id !== "string" || typeof password !== "string")
          throw new TypeError("id and password required");
        const decrypted = decryptSurveillanceFile(id, password);
        return { success: true, buffer: decrypted.buffer.slice(
          decrypted.byteOffset,
          decrypted.byteOffset + decrypted.byteLength,
        ) as ArrayBuffer };
      } catch (err: any) {
        console.error("[ipc] req-vault-decrypt error:", err);
        return { success: false, error: err.message || "Decryption failed — wrong password?" };
      }
    },
  );

  ipcMain.handle(
    "req-vault-delete",
    async (_event: IpcMainInvokeEvent, { id }: { id: string }) => {
      try {
        if (typeof id !== "string") throw new TypeError("id required");
        return deleteSurveillanceFile(id);
      } catch (err) {
        console.error("[ipc] req-vault-delete error:", err);
        return { success: false, error: String(err) };
      }
    },
  );

  // ─── WireGuard VPN ─────────────────────────────────────────────────────────

  ipcMain.handle('vpn:check-installed', async () => {
    return await checkWireGuardInstalled();
  });

  ipcMain.handle('vpn:init-server', async (_e, endpoint: string, port: number) => {
    try {
      const cfg = await initServer(endpoint, port);
      const { privateKey: _pk, ...safe } = cfg;
      return { success: true, config: safe };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('vpn:add-peer', async (_e, name: string) => {
    try {
      const result = await addPeer(name);
      return { success: true, ...result, peer: { ...result.peer, privateKey: undefined } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('vpn:list-peers', async () => {
    return listPeers().map(({ privateKey: _pk, ...safe }) => safe);
  });

  ipcMain.handle('vpn:remove-peer', async (_e, publicKey: string) => {
    try {
      removePeer(publicKey);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('vpn:server-meta', async () => {
    return getServerMeta();
  });

  ipcMain.handle('vpn:start', async () => {
    return await startTunnel();
  });

  ipcMain.handle('vpn:stop', async () => {
    return await stopTunnel();
  });

  ipcMain.handle('vpn:status', async () => {
    return await getTunnelStatus();
  });

  ipcMain.handle('vpn:peer-qr', async (_e, publicKey: string) => {
    try {
      const result = await getPeerClientConf(publicKey);
      if (!result) return { success: false, error: 'Peer not found' };
      return { success: true, ...result };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('vpn:save-config-file', async (_e, { clientConf, fileName }: { clientConf: string; fileName: string }) => {
    try {
      const { filePath, canceled } = await dialog.showSaveDialog({
        title: 'Save WireGuard Peer Configuration',
        defaultPath: fileName,
        filters: [{ name: 'WireGuard Config', extensions: ['conf'] }]
      });
      if (canceled || !filePath) return { success: false };
      fs.writeFileSync(filePath, clientConf, 'utf8');
      return { success: true, filePath };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  console.log("[ipc] All handlers registered");
}
