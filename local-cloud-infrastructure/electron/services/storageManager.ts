import { app, dialog } from "electron";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import os from "os";
import http from "http";
import { logStorageEvent, logBackupEvent } from "../database/queries";
import { encrypt } from "./cryptoEngine";
import * as vaultService from "./vaultService";

export interface StorageStatus {
  path: string;
  totalSpace: number;
  usedSpace: number;
  freeSpace: number;
  allocatedSpace: number;
  appUsedSpace: number;
  localIp: string;
  httpPort: number;
}

export interface BackupJob {
  jobId: string;
  progress: number;
  status: "idle" | "running" | "complete" | "error";
  log: string[];
  bytesWritten: number;
}

const backupJobs = new Map<string, BackupJob>();
const DEFAULT_ALLOCATION = 10 * 1024 * 1024 * 1024;

let cachedPath: string = "";
let cachedAllocation: number = 0;
let httpPort = 8080;
let httpServer: http.Server | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function initCacheSync(): void {
  if (cachedPath) return;
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const content = fs.readFileSync(settingsPath, "utf8");
      const data = JSON.parse(content);
      cachedPath = data.localCloudPath || "";
      cachedAllocation =
        typeof data.allocatedSpace === "number" ? data.allocatedSpace : 0;
    }
  } catch (err) {}
  if (!cachedPath) {
    cachedPath = process.env.LOCAL_CLOUD_DATA_PATH ?? "C:\\LocalCloudData";
  }
  if (!cachedAllocation) {
    cachedAllocation = 10 * 1024 * 1024 * 1024;
  }
}

export function getCurrentStoragePath(): string {
  initCacheSync();
  return cachedPath;
}

function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function startNetworkServer(dirPath: string): void {
  if (httpServer) {
    httpServer.close();
  }

  httpServer = http.createServer(async (req, res) => {
    try {
      // Set CORS Headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, OPTIONS, DELETE",
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-File-Name, X-File-Path, X-Camera-Id",
      );
      res.setHeader("Access-Control-Allow-Private-Network", "true");

      if (req.method === "OPTIONS") {
        res.statusCode = 200;
        res.end();
        return;
      }

      const decodedUrl = decodeURIComponent(req.url || "/").split("?")[0];
      const safePath = path.normalize(path.join(dirPath, decodedUrl));

      if (!safePath.startsWith(dirPath)) {
        res.statusCode = 403;
        res.end("Access Denied");
        return;
      }

      // Handle file deletion
      if (req.method === "POST" && decodedUrl === "/delete") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const fileName = body.name;
            const subPath = body.path || "";
            if (!fileName) {
              res.statusCode = 400;
              res.end("Missing file name");
              return;
            }
            const filePath = path.join(dirPath, subPath, fileName);
            if (fs.existsSync(filePath)) {
              await fs.promises.unlink(filePath);
            }
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // Handle file rename
      if (req.method === "POST" && decodedUrl === "/rename") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const oldName = body.oldName;
            const newName = body.newName;
            const subPath = body.path || "";
            if (!oldName || !newName) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  success: false,
                  message: "Missing parameters",
                }),
              );
              return;
            }
            const oldPath = path.join(dirPath, subPath, oldName);
            const newPath = path.join(dirPath, subPath, newName);
            await fs.promises.rename(oldPath, newPath);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, message: err.message }));
          }
        });
        return;
      }

      // Handle delete all (danger zone)
      if (req.method === "POST" && decodedUrl === "/delete-all") {
        try {
          const entries = await fs.promises.readdir(dirPath, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            if (entry.name === "settings.json") continue;
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
              await fs.promises.rm(fullPath, { recursive: true, force: true });
            } else {
              await fs.promises.unlink(fullPath);
            }
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // ── Surveillance Vault Endpoints ──

      if (req.method === "GET" && decodedUrl === "/surveillance/list") {
        try {
          const files = vaultService.listSurveillanceFiles();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, files }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      if (req.method === "POST" && decodedUrl === "/surveillance/verify") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const result = vaultService.checkVaultPassword(body.password);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      if (req.method === "POST" && decodedUrl === "/surveillance/decrypt") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const decrypted = vaultService.decryptSurveillanceFile(
              body.id,
              body.password,
            );

            // For playback, we write to a temporary file in the userData folder
            // and return a URL that can be used to stream it
            const tempDir = path.join(
              app.getPath("userData"),
              "temp_surveillance",
            );
            if (!fs.existsSync(tempDir))
              fs.mkdirSync(tempDir, { recursive: true });

            const tempFileName = `temp_${Date.now()}_${body.id}.mp4`;
            const tempPath = path.join(tempDir, tempFileName);
            fs.writeFileSync(tempPath, decrypted);

            // The temporary file will be served by this same server
            const tempUrl = `/temp_surveillance/${tempFileName}`;

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true, tempUrl }));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      if (req.method === "POST" && decodedUrl === "/surveillance/delete") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const result = vaultService.deleteSurveillanceFile(body.id);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // Serve temp surveillance files
      if (
        req.method === "GET" &&
        decodedUrl.startsWith("/temp_surveillance/")
      ) {
        const fileName = path.basename(decodedUrl);
        const filePath = path.join(
          app.getPath("userData"),
          "temp_surveillance",
          fileName,
        );
        if (fs.existsSync(filePath)) {
          const stat = fs.statSync(filePath);
          res.statusCode = 200;
          res.setHeader("Content-Type", "video/mp4");
          res.setHeader("Content-Length", stat.size);
          fs.createReadStream(filePath).pipe(res);
          return;
        }
      }

      // Handle file copy / duplicate (server-side)
      if (req.method === "POST" && decodedUrl === "/copy") {
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString());
            const srcName = body.srcName;
            const destName = body.destName;
            const subPath = body.path || "";
            if (!srcName || !destName) {
              res.statusCode = 400;
              res.end(
                JSON.stringify({
                  success: false,
                  message: "Missing parameters",
                }),
              );
              return;
            }
            const srcPath = path.join(dirPath, subPath, srcName);
            const destPath = path.join(dirPath, subPath, destName);
            await fs.promises.copyFile(srcPath, destPath);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ success: true }));
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, message: err.message }));
          }
        });
        return;
      }

      // Handle binary file upload
      if (req.method === "POST" && decodedUrl === "/upload") {
        const fileName = req.headers["x-file-name"] as string;
        const subPath = (req.headers["x-file-path"] as string) || "";
        if (!fileName) {
          res.statusCode = 400;
          res.end("Missing X-File-Name header");
          return;
        }
        const filePath = path.join(dirPath, subPath, fileName);
        const writeStream = fs.createWriteStream(filePath);
        req.pipe(writeStream);
        req.on("end", () => {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        });
        req.on("error", (err) => {
          res.statusCode = 500;
          res.end(JSON.stringify({ success: false, error: err.message }));
        });
        return;
      }

      // Handle API files request
      if (
        req.method === "GET" &&
        (decodedUrl === "/api/files" || decodedUrl === "/api/status")
      ) {
        const entries = await fs.promises.readdir(dirPath, {
          withFileTypes: true,
        });
        const fileList = [];
        for (const entry of entries) {
          if (entry.name === "settings.json" || entry.name === "streams")
            continue;
          try {
            const entryPath = path.join(dirPath, entry.name);
            const entryStat = await fs.promises.stat(entryPath);
            fileList.push({
              name: entry.name,
              size: entryStat.size,
              isDirectory: entry.isDirectory(),
              relativePath: entry.name,
            });
          } catch (e) {}
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ success: true, files: fileList }));
        return;
      }

      // Handle actual storage status query
      if (req.method === "GET" && decodedUrl === "/api/storage-status") {
        try {
          const status = await getStorageStatus();
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, ...status }));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      // Handle remote camera stream chunk uploads
      if (req.method === "POST" && decodedUrl === "/upload-chunk") {
        const cameraId = (req.headers["x-camera-id"] as string) || "remote-cam";
        const baseStreamDir = path.join(dirPath, "streams");
        const outputDir = path.join(baseStreamDir, cameraId);
        await fs.promises.mkdir(outputDir, { recursive: true });

        const chunkPath = path.join(outputDir, `remote-stream.enc`);
        const writeStream = fs.createWriteStream(chunkPath, { flags: "a" });

        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const raw = Buffer.concat(chunks);
          try {
            const encrypted = encrypt(raw);
            writeStream.write(encrypted, (err) => {
              writeStream.end();
              if (err) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: err.message }));
              } else {
                res.statusCode = 200;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ success: true }));
              }
            });
          } catch (err: any) {
            writeStream.end();
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      const stat = await fs.promises.stat(safePath).catch(async () => {
        if (safePath === dirPath) {
          await fs.promises.mkdir(dirPath, { recursive: true });
          return await fs.promises.stat(dirPath);
        }
        throw new Error("File Not Found");
      });

      if (stat.isDirectory()) {
        const entries = await fs.promises.readdir(safePath, {
          withFileTypes: true,
        });

        // Check if JSON response requested
        if (
          req.headers.accept &&
          req.headers.accept.includes("application/json")
        ) {
          const fileList = [];
          for (const entry of entries) {
            if (entry.name === "settings.json") continue;
            const entryPath = path.join(safePath, entry.name);
            const entryStat = await fs.promises.stat(entryPath);
            fileList.push({
              name: entry.name,
              size: entryStat.size,
              isDirectory: entry.isDirectory(),
              relativePath: path
                .join(decodedUrl, entry.name)
                .replace(/\\/g, "/"),
            });
          }
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true, files: fileList }));
          return;
        }

        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.write("<!DOCTYPE html><html><head><style>");
        res.write(
          "body { font-family: sans-serif; background: #080b16; color: #f8fafc; padding: 24px; }",
        );
        res.write(
          "a { color: #3b82f6; text-decoration: none; display: block; margin: 12px 0; font-size: 1.1rem; }",
        );
        res.write("a:hover { text-decoration: underline; color: #60a5fa; }");
        res.write(
          "hr { border: 0; border-top: 1px solid #1e293b; margin: 24px 0; }",
        );
        res.write(
          "h1 { font-size: 1.8rem; font-weight: 700; color: #f8fafc; }",
        );
        res.write("</style></head><body>");
        res.write(
          `<h1>Local Cloud Explorer</h1><p>Path: ${decodedUrl}</p><hr>`,
        );

        if (decodedUrl !== "/") {
          res.write('<a href="..">📁 Up to parent directory</a>');
        }

        for (const entry of entries) {
          if (entry.name === "settings.json") continue;
          const icon = entry.isDirectory() ? "📁" : "📄";
          const link = path.join(decodedUrl, entry.name).replace(/\\/g, "/");
          res.write(`<a href="${link}">${icon} ${entry.name}</a>`);
        }
        res.write("</body></html>");
        res.end();
      } else {
        res.setHeader("Content-Length", stat.size);
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${path.basename(safePath)}"`,
        );
        const stream = fs.createReadStream(safePath);
        stream.pipe(res);
      }
    } catch (err: any) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  });

  httpServer
    .listen(httpPort, "0.0.0.0", () => {
      console.log(`Server listening on port ${httpPort}`);
    })
    .on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        httpPort += 1;
        startNetworkServer(dirPath);
      }
    });
}

async function getDirSize(dirPath: string): Promise<number> {
  let size = 0;
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += await getDirSize(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.promises.stat(fullPath);
        size += stats.size;
      }
    }
  } catch (err) {}
  return size;
}

export async function selectFolder(): Promise<{ path: string | null }> {
  initCacheSync();
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "Select Local Cloud Storage Directory",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { path: null };
  }

  const selectedPath = result.filePaths[0];
  cachedPath = selectedPath;

  try {
    const settingsPath = getSettingsPath();
    const settings = {
      localCloudPath: cachedPath,
      allocatedSpace: cachedAllocation,
    };
    const dir = path.dirname(settingsPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      settingsPath,
      JSON.stringify(settings, null, 2),
      "utf8",
    );

    await fs.promises.mkdir(cachedPath, { recursive: true });
    startNetworkServer(cachedPath);
  } catch (err) {
    console.error(err);
  }

  return { path: cachedPath };
}

export async function updateAllocation(
  bytes: number,
): Promise<{ success: boolean; allocatedSpace: number }> {
  try {
    initCacheSync();
    cachedAllocation = bytes;

    const settingsPath = getSettingsPath();
    const settings = {
      localCloudPath: cachedPath,
      allocatedSpace: cachedAllocation,
    };
    const dir = path.dirname(settingsPath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      settingsPath,
      JSON.stringify(settings, null, 2),
      "utf8",
    );

    return { success: true, allocatedSpace: bytes };
  } catch (err) {
    console.error(err);
    return { success: false, allocatedSpace: cachedAllocation };
  }
}

export async function getStorageStatus(): Promise<StorageStatus> {
  try {
    initCacheSync();
    await fs.promises.mkdir(cachedPath, { recursive: true });

    const stats = await fs.promises.statfs(cachedPath);
    const totalSpace = stats.blocks * stats.bsize;
    const freeSpace = stats.bfree * stats.bsize;
    const usedSpace = totalSpace - freeSpace;

    const appUsedSpace = await getDirSize(cachedPath);

    if (!httpServer) {
      startNetworkServer(cachedPath);
    }

    const result: StorageStatus = {
      path: cachedPath,
      totalSpace,
      usedSpace,
      freeSpace,
      allocatedSpace: cachedAllocation,
      appUsedSpace,
      localIp: getLocalIpAddress(),
      httpPort,
    };

    logStorageEvent(result).catch((err) => console.warn(err.message));

    return result;
  } catch (err) {
    console.error(err);
    return {
      path: cachedPath,
      totalSpace: 0,
      usedSpace: 0,
      freeSpace: 0,
      allocatedSpace: cachedAllocation || DEFAULT_ALLOCATION,
      appUsedSpace: 0,
      localIp: getLocalIpAddress(),
      httpPort,
    };
  }
}

export async function runBackup(): Promise<{ jobId: string }> {
  const jobId = crypto.randomUUID();

  const job: BackupJob = {
    jobId,
    progress: 0,
    status: "running",
    log: [`[${new Date().toISOString()}] Backup job ${jobId} started`],
    bytesWritten: 0,
  };

  backupJobs.set(jobId, job);

  executeBackup(jobId).catch((err) => {
    const j = backupJobs.get(jobId);
    if (j) {
      j.status = "error";
      j.log.push(`[ERROR] ${err.message}`);
    }
  });

  return { jobId };
}

async function executeBackup(jobId: string): Promise<void> {
  const job = backupJobs.get(jobId)!;
  const fsPromises = fs.promises;
  const currentPath = getCurrentStoragePath();

  try {
    job.log.push(`Scanning ${currentPath}...`);
    job.progress = 10;

    await fsPromises.mkdir(currentPath, { recursive: true });
    const entries = await fsPromises.readdir(currentPath, {
      withFileTypes: true,
    });

    const totalFiles = entries.filter((e) => e.isFile()).length;
    let processed = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name === "settings.json") continue;
      const filePath = path.join(currentPath, entry.name);
      const stat = await fsPromises.stat(filePath);
      job.bytesWritten += stat.size;
      processed++;
      job.progress =
        10 + Math.floor((processed / Math.max(totalFiles, 1)) * 85);
      job.log.push(
        `Backed up: ${entry.name} (${(stat.size / 1024).toFixed(1)} KB)`,
      );
    }

    job.status = "complete";
    job.progress = 100;
    job.log.push(
      `[${new Date().toISOString()}] Backup complete. ${processed} files, ${(job.bytesWritten / 1024 / 1024).toFixed(2)} MB`,
    );

    await logBackupEvent({
      jobId,
      status: "complete",
      bytesWritten: job.bytesWritten,
    });
  } catch (err: any) {
    job.status = "error";
    job.log.push(`[ERROR] ${err.message}`);
    await logBackupEvent({
      jobId,
      status: "error",
      bytesWritten: job.bytesWritten,
    });
    throw err;
  }
}

export async function getBackupStatus(jobId: string): Promise<BackupJob> {
  const job = backupJobs.get(jobId);
  if (!job) {
    return { jobId, progress: 0, status: "idle", log: [], bytesWritten: 0 };
  }
  return { ...job };
}
