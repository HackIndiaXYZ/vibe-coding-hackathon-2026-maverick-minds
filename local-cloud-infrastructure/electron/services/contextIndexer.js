"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isContextSupportedFile = isContextSupportedFile;
exports.getFileTypeLabel = getFileTypeLabel;
exports.initContextIndexer = initContextIndexer;
exports.listContextFiles = listContextFiles;
exports.addContextFile = addContextFile;
exports.addContextDirectory = addContextDirectory;
exports.removeContextFile = removeContextFile;
exports.searchContext = searchContext;
exports.getContextDirPath = getContextDirPath;
exports.addContextDockerFiles = addContextDockerFiles;
exports.copyFileToContext = copyFileToContext;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
const storageManager_1 = require("./storageManager");
const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;
const SUPPORTED_EXTENSIONS = new Set([
    '.txt', '.md', '.json', '.yaml', '.yml', '.csv', '.html', '.css', '.js', '.ts',
    '.py', '.xml', '.log', '.ini', '.cfg', '.toml', '.dockerfile', '.env',
]);
const DOCKER_SPECIAL_NAMES = new Set([
    'dockerfile',
    '.dockerignore',
    'docker-compose.yml',
    'docker-compose.yaml',
    'compose.yml',
    'compose.yaml',
]);
function isContextSupportedFile(fileName) {
    const lower = fileName.toLowerCase();
    if (DOCKER_SPECIAL_NAMES.has(lower))
        return true;
    if (lower.startsWith('dockerfile.'))
        return true;
    const ext = path_1.default.extname(fileName).toLowerCase();
    return SUPPORTED_EXTENSIONS.has(ext);
}
function getFileTypeLabel(fileName) {
    const lower = fileName.toLowerCase();
    if (lower === 'dockerfile' || lower.startsWith('dockerfile.'))
        return 'dockerfile';
    if (lower.includes('docker-compose') || lower === 'compose.yml' || lower === 'compose.yaml')
        return 'compose';
    if (lower === '.dockerignore')
        return 'dockerignore';
    return path_1.default.extname(fileName).slice(1) || 'file';
}
const STOP_WORDS = new Set(`
  the a an is are was were be been being to of in for on at by with from
  and or if then else when while as it this that those these i you he she
  we they my your our their me him her us them
`.trim().split(/\s+/));
let chunkIndex = [];
let manifest = { files: [] };
function getManifestPath() {
    return path_1.default.join(electron_1.app.getPath('userData'), 'chatbot-context.json');
}
function getContextDir() {
    return path_1.default.join((0, storageManager_1.getCurrentStoragePath)(), 'chatbot-context');
}
function tokenize(text) {
    const tokens = text.toLowerCase().match(/[a-z0-9_\-]+/g) || [];
    return new Set(tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t)));
}
function splitChunks(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return [];
    const chunks = [];
    let i = 0;
    const n = trimmed.length;
    while (i < n) {
        const j = Math.min(i + CHUNK_SIZE, n);
        chunks.push(trimmed.slice(i, j));
        if (j >= n)
            break;
        i = j - CHUNK_OVERLAP > i ? j - CHUNK_OVERLAP : j;
    }
    return chunks;
}
function readTextFile(filePath) {
    try {
        return fs_1.default.readFileSync(filePath, 'utf8');
    }
    catch {
        return '';
    }
}
function resolveStoragePath(relativePath) {
    const storageRoot = path_1.default.resolve((0, storageManager_1.getCurrentStoragePath)());
    const resolved = path_1.default.resolve(storageRoot, relativePath);
    if (!resolved.startsWith(storageRoot)) {
        throw new Error('Path outside storage root');
    }
    return resolved;
}
function saveManifest() {
    const manifestPath = getManifestPath();
    const dir = path_1.default.dirname(manifestPath);
    fs_1.default.mkdirSync(dir, { recursive: true });
    fs_1.default.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}
function loadManifest() {
    const manifestPath = getManifestPath();
    if (fs_1.default.existsSync(manifestPath)) {
        try {
            manifest = JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf8'));
        }
        catch {
            manifest = { files: [] };
        }
    }
}
function rebuildChunkIndex() {
    chunkIndex = [];
    const storageRoot = (0, storageManager_1.getCurrentStoragePath)();
    for (const file of manifest.files) {
        const absPath = path_1.default.join(storageRoot, file.relativePath);
        if (!fs_1.default.existsSync(absPath))
            continue;
        const text = readTextFile(absPath);
        const chunks = splitChunks(text);
        for (let i = 0; i < chunks.length; i++) {
            chunkIndex.push({
                fileId: file.id,
                fileName: file.name,
                chunkIndex: i,
                text: chunks[i],
            });
        }
    }
}
function initContextIndexer() {
    loadManifest();
    rebuildChunkIndex();
    fs_1.default.mkdirSync(getContextDir(), { recursive: true });
}
function listContextFiles() {
    return [...manifest.files];
}
function addContextFile(relativePath) {
    const absPath = resolveStoragePath(relativePath);
    if (!fs_1.default.existsSync(absPath)) {
        throw new Error('File not found');
    }
    const stat = fs_1.default.statSync(absPath);
    if (!stat.isFile()) {
        throw new Error('Path is not a file');
    }
    const ext = path_1.default.extname(absPath).toLowerCase();
    if (!isContextSupportedFile(path_1.default.basename(absPath))) {
        throw new Error(`Unsupported file type: ${ext || path_1.default.basename(absPath)}`);
    }
    const storageRoot = (0, storageManager_1.getCurrentStoragePath)();
    const normalizedRelative = path_1.default.relative(storageRoot, absPath).replace(/\\/g, '/');
    const existing = manifest.files.find((f) => f.relativePath === normalizedRelative);
    if (existing)
        return existing;
    const text = readTextFile(absPath);
    const chunks = splitChunks(text);
    const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: path_1.default.basename(absPath),
        relativePath: normalizedRelative,
        size: stat.size,
        chunkCount: chunks.length,
        indexedAt: new Date().toISOString(),
        fileType: getFileTypeLabel(path_1.default.basename(absPath)),
    };
    manifest.files.push(entry);
    saveManifest();
    for (let i = 0; i < chunks.length; i++) {
        chunkIndex.push({
            fileId: entry.id,
            fileName: entry.name,
            chunkIndex: i,
            text: chunks[i],
        });
    }
    return entry;
}
function addContextDirectory(relativeDir) {
    const absDir = resolveStoragePath(relativeDir);
    if (!fs_1.default.existsSync(absDir)) {
        throw new Error('Directory not found');
    }
    const added = [];
    const walk = (dir) => {
        for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const full = path_1.default.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            }
            else if (entry.isFile()) {
                if (!isContextSupportedFile(entry.name))
                    continue;
                const storageRoot = (0, storageManager_1.getCurrentStoragePath)();
                const rel = path_1.default.relative(storageRoot, full).replace(/\\/g, '/');
                try {
                    added.push(addContextFile(rel));
                }
                catch {
                    // skip duplicates or invalid
                }
            }
        }
    };
    walk(absDir);
    return added;
}
function removeContextFile(fileId) {
    const idx = manifest.files.findIndex((f) => f.id === fileId);
    if (idx === -1)
        return false;
    manifest.files.splice(idx, 1);
    chunkIndex = chunkIndex.filter((c) => c.fileId !== fileId);
    saveManifest();
    return true;
}
function searchContext(query, k = 5) {
    const q = tokenize(query);
    if (q.size === 0 || chunkIndex.length === 0)
        return [];
    const scored = [];
    for (const chunk of chunkIndex) {
        const chunkTokens = tokenize(chunk.text);
        let score = 0;
        for (const token of q) {
            if (chunkTokens.has(token))
                score++;
        }
        if (score > 0) {
            scored.push({ score, fileName: chunk.fileName, chunkIndex: chunk.chunkIndex, text: chunk.text });
        }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k).map((s) => `[${s.fileName} :: chunk ${s.chunkIndex + 1}]\n${s.text}`);
}
function getContextDirPath() {
    return getContextDir();
}
function addContextDockerFiles() {
    const storageRoot = (0, storageManager_1.getCurrentStoragePath)();
    const added = [];
    const scan = (dir) => {
        if (!fs_1.default.existsSync(dir))
            return;
        for (const entry of fs_1.default.readdirSync(dir, { withFileTypes: true })) {
            const full = path_1.default.join(dir, entry.name);
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                scan(full);
            }
            else if (entry.isFile() && isContextSupportedFile(entry.name)) {
                const lower = entry.name.toLowerCase();
                const isDockerRelated = lower === 'dockerfile' ||
                    lower.startsWith('dockerfile.') ||
                    lower.includes('docker-compose') ||
                    lower === 'compose.yml' ||
                    lower === 'compose.yaml' ||
                    lower === '.dockerignore';
                if (!isDockerRelated)
                    continue;
                const rel = path_1.default.relative(storageRoot, full).replace(/\\/g, '/');
                try {
                    added.push(addContextFile(rel));
                }
                catch {
                    // skip duplicates
                }
            }
        }
    };
    scan(storageRoot);
    return added;
}
function copyFileToContext(sourcePath) {
    const contextDir = getContextDir();
    fs_1.default.mkdirSync(contextDir, { recursive: true });
    const fileName = path_1.default.basename(sourcePath);
    const destPath = path_1.default.join(contextDir, fileName);
    if (path_1.default.resolve(sourcePath) !== path_1.default.resolve(destPath)) {
        fs_1.default.copyFileSync(sourcePath, destPath);
    }
    const storageRoot = (0, storageManager_1.getCurrentStoragePath)();
    const relativePath = path_1.default.relative(storageRoot, destPath).replace(/\\/g, '/');
    return addContextFile(relativePath);
}
