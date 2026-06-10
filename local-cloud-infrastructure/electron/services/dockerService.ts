import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const execFileAsync = promisify(execFile);

export type GpuProfile = 'cpu' | 'nvidia' | 'amd';

export interface DockerServiceStatus {
  dockerInstalled: boolean;
  dockerRunning: boolean;
  ollamaRunning: boolean;
  ollamaContainer: string | null;
  activeProfile: GpuProfile;
  composePath: string;
  logs: string[];
}

let activeProfile: GpuProfile = 'cpu';
let lastLogs: string[] = [];

function getInfrastructureDir(): string {
  const candidates = [
    path.join(process.cwd(), 'infrastructure'),
    path.join(app.getAppPath(), 'infrastructure'),
    path.join(__dirname, '..', '..', 'infrastructure'),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
      return dir;
    }
  }

  return path.join(process.cwd(), 'infrastructure');
}

function getComposeFile(profile: GpuProfile): string {
  const infraDir = getInfrastructureDir();
  switch (profile) {
    case 'nvidia':
      return path.join(infraDir, 'docker-compose.gpu-nvidia.yml');
    case 'amd':
      return path.join(infraDir, 'docker-compose.gpu-amd.yml');
    default:
      return path.join(infraDir, 'docker-compose.yml');
  }
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || stdout || err.message));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

async function isDockerInstalled(): Promise<boolean> {
  try {
    await runCommand('docker', ['--version'], process.cwd());
    return true;
  } catch {
    return false;
  }
}

async function isDockerRunning(): Promise<boolean> {
  try {
    await runCommand('docker', ['info'], process.cwd());
    return true;
  } catch {
    return false;
  }
}

async function getOllamaContainerStatus(): Promise<{ running: boolean; name: string | null }> {
  try {
    const { stdout } = await runCommand(
      'docker',
      ['ps', '--filter', 'name=localcloud-ollama', '--format', '{{.Names}}'],
      process.cwd(),
    );
    const name = stdout.trim().split('\n').find((n) => n.includes('localcloud-ollama')) || null;
    return { running: !!name, name };
  } catch {
    return { running: false, name: null };
  }
}

function appendLog(line: string): void {
  lastLogs.push(`[${new Date().toISOString()}] ${line}`);
  if (lastLogs.length > 50) lastLogs = lastLogs.slice(-50);
}

export async function getDockerServiceStatus(): Promise<DockerServiceStatus> {
  const installed = await isDockerInstalled();
  const running = installed ? await isDockerRunning() : false;
  const ollama = running ? await getOllamaContainerStatus() : { running: false, name: null };

  return {
    dockerInstalled: installed,
    dockerRunning: running,
    ollamaRunning: ollama.running,
    ollamaContainer: ollama.name,
    activeProfile,
    composePath: getComposeFile(activeProfile),
    logs: [...lastLogs],
  };
}

export async function startOllamaDocker(profile: GpuProfile = 'cpu'): Promise<DockerServiceStatus> {
  activeProfile = profile;
  const composeFile = getComposeFile(profile);
  const cwd = getInfrastructureDir();

  if (!fs.existsSync(composeFile)) {
    throw new Error(`Compose file not found: ${composeFile}`);
  }

  appendLog(`Starting Ollama (${profile}) via ${path.basename(composeFile)}`);

  try {
    await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d', 'ollama'], cwd);
    appendLog('Ollama container started');

    const model = process.env.OLLAMA_MODEL || 'llama3.2';
    appendLog(`Pulling model ${model}...`);
    try {
      await runCommand('docker', ['exec', 'localcloud-ollama', 'ollama', 'pull', model], cwd);
      appendLog(`Model ${model} ready`);
    } catch (pullErr) {
      appendLog(`Model pull skipped: ${pullErr instanceof Error ? pullErr.message : 'failed'}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Docker start failed';
    appendLog(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  return getDockerServiceStatus();
}

export async function stopOllamaDocker(): Promise<DockerServiceStatus> {
  const composeFile = getComposeFile(activeProfile);
  const cwd = getInfrastructureDir();

  appendLog('Stopping Ollama container');

  try {
    await runCommand('docker', ['compose', '-f', composeFile, 'stop', 'ollama'], cwd);
    appendLog('Ollama container stopped');
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Docker stop failed';
    appendLog(`ERROR: ${msg}`);
    throw new Error(msg);
  }

  return getDockerServiceStatus();
}

export async function pullOllamaModel(model: string): Promise<void> {
  appendLog(`Pulling model ${model}`);
  await runCommand('docker', ['exec', 'localcloud-ollama', 'ollama', 'pull', model], getInfrastructureDir());
  appendLog(`Model ${model} pulled`);
}

export function getActiveGpuProfile(): GpuProfile {
  return activeProfile;
}

export function getInfrastructurePath(): string {
  return getInfrastructureDir();
}
