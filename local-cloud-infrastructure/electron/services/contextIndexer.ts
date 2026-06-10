import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { getCurrentStoragePath } from './storageManager';

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

export function isContextSupportedFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  if (DOCKER_SPECIAL_NAMES.has(lower)) return true;
  if (lower.startsWith('dockerfile.')) return true;
  const ext = path.extname(fileName).toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
}

export function getFileTypeLabel(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower === 'dockerfile' || lower.startsWith('dockerfile.')) return 'dockerfile';
  if (lower.includes('docker-compose') || lower === 'compose.yml' || lower === 'compose.yaml') return 'compose';
  if (lower === '.dockerignore') return 'dockerignore';
  return path.extname(fileName).slice(1) || 'file';
}

const STOP_WORDS = new Set(`
  the a an is are was were be been being to of in for on at by with from
  and or if then else when while as it this that those these i you he she
  we they my your our their me him her us them
`.trim().split(/\s+/));

export interface ContextFileEntry {
  id: string;
  name: string;
  relativePath: string;
  size: number;
  chunkCount: number;
  indexedAt: string;
  fileType?: string;
}

interface IndexedChunk {
  fileId: string;
  fileName: string;
  chunkIndex: number;
  text: string;
}

interface ContextManifest {
  files: ContextFileEntry[];
}

let chunkIndex: IndexedChunk[] = [];
let manifest: ContextManifest = { files: [] };

function getManifestPath(): string {
  return path.join(app.getPath('userData'), 'chatbot-context.json');
}

function getContextDir(): string {
  return path.join(getCurrentStoragePath(), 'chatbot-context');
}

function tokenize(text: string): Set<string> {
  const tokens = text.toLowerCase().match(/[a-z0-9_\-]+/g) || [];
  return new Set(tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t)));
}

function splitChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  let i = 0;
  const n = trimmed.length;

  while (i < n) {
    const j = Math.min(i + CHUNK_SIZE, n);
    chunks.push(trimmed.slice(i, j));
    if (j >= n) break;
    i = j - CHUNK_OVERLAP > i ? j - CHUNK_OVERLAP : j;
  }

  return chunks;
}

function readTextFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function resolveStoragePath(relativePath: string): string {
  const storageRoot = path.resolve(getCurrentStoragePath());
  const resolved = path.resolve(storageRoot, relativePath);
  if (!resolved.startsWith(storageRoot)) {
    throw new Error('Path outside storage root');
  }
  return resolved;
}

function saveManifest(): void {
  const manifestPath = getManifestPath();
  const dir = path.dirname(manifestPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function loadManifest(): void {
  const manifestPath = getManifestPath();
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch {
      manifest = { files: [] };
    }
  }
}

function rebuildChunkIndex(): void {
  chunkIndex = [];
  const storageRoot = getCurrentStoragePath();

  for (const file of manifest.files) {
    const absPath = path.join(storageRoot, file.relativePath);
    if (!fs.existsSync(absPath)) continue;

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

export function initContextIndexer(): void {
  loadManifest();
  rebuildChunkIndex();
  fs.mkdirSync(getContextDir(), { recursive: true });
}

export function listContextFiles(): ContextFileEntry[] {
  return [...manifest.files];
}

export function addContextFile(relativePath: string): ContextFileEntry {
  const absPath = resolveStoragePath(relativePath);
  if (!fs.existsSync(absPath)) {
    throw new Error('File not found');
  }

  const stat = fs.statSync(absPath);
  if (!stat.isFile()) {
    throw new Error('Path is not a file');
  }

  const ext = path.extname(absPath).toLowerCase();
  if (!isContextSupportedFile(path.basename(absPath))) {
    throw new Error(`Unsupported file type: ${ext || path.basename(absPath)}`);
  }

  const storageRoot = getCurrentStoragePath();
  const normalizedRelative = path.relative(storageRoot, absPath).replace(/\\/g, '/');
  const existing = manifest.files.find((f) => f.relativePath === normalizedRelative);
  if (existing) return existing;

  const text = readTextFile(absPath);
  const chunks = splitChunks(text);

  const entry: ContextFileEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: path.basename(absPath),
    relativePath: normalizedRelative,
    size: stat.size,
    chunkCount: chunks.length,
    indexedAt: new Date().toISOString(),
    fileType: getFileTypeLabel(path.basename(absPath)),
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

export function addContextDirectory(relativeDir: string): ContextFileEntry[] {
  const absDir = resolveStoragePath(relativeDir);
  if (!fs.existsSync(absDir)) {
    throw new Error('Directory not found');
  }

  const added: ContextFileEntry[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        if (!isContextSupportedFile(entry.name)) continue;
        const storageRoot = getCurrentStoragePath();
        const rel = path.relative(storageRoot, full).replace(/\\/g, '/');
        try {
          added.push(addContextFile(rel));
        } catch {
          // skip duplicates or invalid
        }
      }
    }
  };

  walk(absDir);
  return added;
}

export function removeContextFile(fileId: string): boolean {
  const idx = manifest.files.findIndex((f) => f.id === fileId);
  if (idx === -1) return false;

  manifest.files.splice(idx, 1);
  chunkIndex = chunkIndex.filter((c) => c.fileId !== fileId);
  saveManifest();
  return true;
}

export function searchContext(query: string, k = 5): string[] {
  const q = tokenize(query);
  if (q.size === 0 || chunkIndex.length === 0) return [];

  const scored: { score: number; fileName: string; chunkIndex: number; text: string }[] = [];

  for (const chunk of chunkIndex) {
    const chunkTokens = tokenize(chunk.text);
    let score = 0;
    for (const token of q) {
      if (chunkTokens.has(token)) score++;
    }
    if (score > 0) {
      scored.push({ score, fileName: chunk.fileName, chunkIndex: chunk.chunkIndex, text: chunk.text });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, k).map(
    (s) => `[${s.fileName} :: chunk ${s.chunkIndex + 1}]\n${s.text}`,
  );
}

export function getContextDirPath(): string {
  return getContextDir();
}

export function addContextDockerFiles(): ContextFileEntry[] {
  const storageRoot = getCurrentStoragePath();
  const added: ContextFileEntry[] = [];

  const scan = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scan(full);
      } else if (entry.isFile() && isContextSupportedFile(entry.name)) {
        const lower = entry.name.toLowerCase();
        const isDockerRelated =
          lower === 'dockerfile' ||
          lower.startsWith('dockerfile.') ||
          lower.includes('docker-compose') ||
          lower === 'compose.yml' ||
          lower === 'compose.yaml' ||
          lower === '.dockerignore';
        if (!isDockerRelated) continue;

        const rel = path.relative(storageRoot, full).replace(/\\/g, '/');
        try {
          added.push(addContextFile(rel));
        } catch {
          // skip duplicates
        }
      }
    }
  };

  scan(storageRoot);
  return added;
}

export function copyFileToContext(sourcePath: string): ContextFileEntry {
  const contextDir = getContextDir();
  fs.mkdirSync(contextDir, { recursive: true });

  const fileName = path.basename(sourcePath);
  const destPath = path.join(contextDir, fileName);

  if (path.resolve(sourcePath) !== path.resolve(destPath)) {
    fs.copyFileSync(sourcePath, destPath);
  }

  const storageRoot = getCurrentStoragePath();
  const relativePath = path.relative(storageRoot, destPath).replace(/\\/g, '/');
  return addContextFile(relativePath);
}
