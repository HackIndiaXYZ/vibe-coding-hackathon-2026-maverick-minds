"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDockerServiceStatus = getDockerServiceStatus;
exports.startOllamaDocker = startOllamaDocker;
exports.stopOllamaDocker = stopOllamaDocker;
exports.pullOllamaModel = pullOllamaModel;
exports.getActiveGpuProfile = getActiveGpuProfile;
exports.getInfrastructurePath = getInfrastructurePath;
const child_process_1 = require("child_process");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const electron_1 = require("electron");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
let activeProfile = 'cpu';
let lastLogs = [];
function getInfrastructureDir() {
    const candidates = [
        path_1.default.join(process.cwd(), 'infrastructure'),
        path_1.default.join(electron_1.app.getAppPath(), 'infrastructure'),
        path_1.default.join(__dirname, '..', '..', 'infrastructure'),
    ];
    for (const dir of candidates) {
        if (fs_1.default.existsSync(path_1.default.join(dir, 'docker-compose.yml'))) {
            return dir;
        }
    }
    return path_1.default.join(process.cwd(), 'infrastructure');
}
function getComposeFile(profile) {
    const infraDir = getInfrastructureDir();
    switch (profile) {
        case 'nvidia':
            return path_1.default.join(infraDir, 'docker-compose.gpu-nvidia.yml');
        case 'amd':
            return path_1.default.join(infraDir, 'docker-compose.gpu-amd.yml');
        default:
            return path_1.default.join(infraDir, 'docker-compose.yml');
    }
}
function runCommand(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
        (0, child_process_1.execFile)(cmd, args, { cwd, timeout: 120000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout, stderr) => {
            if (err) {
                reject(new Error(stderr || stdout || err.message));
                return;
            }
            resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
        });
    });
}
async function isDockerInstalled() {
    try {
        await runCommand('docker', ['--version'], process.cwd());
        return true;
    }
    catch {
        return false;
    }
}
async function isDockerRunning() {
    try {
        await runCommand('docker', ['info'], process.cwd());
        return true;
    }
    catch {
        return false;
    }
}
async function getOllamaContainerStatus() {
    try {
        const { stdout } = await runCommand('docker', ['ps', '--filter', 'name=localcloud-ollama', '--format', '{{.Names}}'], process.cwd());
        const name = stdout.trim().split('\n').find((n) => n.includes('localcloud-ollama')) || null;
        return { running: !!name, name };
    }
    catch {
        return { running: false, name: null };
    }
}
function appendLog(line) {
    lastLogs.push(`[${new Date().toISOString()}] ${line}`);
    if (lastLogs.length > 50)
        lastLogs = lastLogs.slice(-50);
}
async function getDockerServiceStatus() {
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
async function startOllamaDocker(profile = 'cpu') {
    activeProfile = profile;
    const composeFile = getComposeFile(profile);
    const cwd = getInfrastructureDir();
    if (!fs_1.default.existsSync(composeFile)) {
        throw new Error(`Compose file not found: ${composeFile}`);
    }
    appendLog(`Starting Ollama (${profile}) via ${path_1.default.basename(composeFile)}`);
    try {
        await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d', 'ollama'], cwd);
        appendLog('Ollama container started');
        const model = process.env.OLLAMA_MODEL || 'llama3.2';
        appendLog(`Pulling model ${model}...`);
        try {
            await runCommand('docker', ['exec', 'localcloud-ollama', 'ollama', 'pull', model], cwd);
            appendLog(`Model ${model} ready`);
        }
        catch (pullErr) {
            appendLog(`Model pull skipped: ${pullErr instanceof Error ? pullErr.message : 'failed'}`);
        }
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Docker start failed';
        appendLog(`ERROR: ${msg}`);
        throw new Error(msg);
    }
    return getDockerServiceStatus();
}
async function stopOllamaDocker() {
    const composeFile = getComposeFile(activeProfile);
    const cwd = getInfrastructureDir();
    appendLog('Stopping Ollama container');
    try {
        await runCommand('docker', ['compose', '-f', composeFile, 'stop', 'ollama'], cwd);
        appendLog('Ollama container stopped');
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Docker stop failed';
        appendLog(`ERROR: ${msg}`);
        throw new Error(msg);
    }
    return getDockerServiceStatus();
}
async function pullOllamaModel(model) {
    appendLog(`Pulling model ${model}`);
    await runCommand('docker', ['exec', 'localcloud-ollama', 'ollama', 'pull', model], getInfrastructureDir());
    appendLog(`Model ${model} pulled`);
}
function getActiveGpuProfile() {
    return activeProfile;
}
function getInfrastructurePath() {
    return getInfrastructureDir();
}
