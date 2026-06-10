"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = query;
exports.closePool = closePool;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(process.cwd(), '.env') });
const poolConfig = {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER ?? 'localcloud',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? 'localcloud_db',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: false,
};
let pool = null;
function getPool() {
    if (!pool) {
        pool = new pg_1.Pool(poolConfig);
        pool.on('error', (err) => {
            console.error('[dbClient] Unexpected pool error:', err);
        });
        pool.on('connect', () => {
            console.log('[dbClient] New pg connection established');
        });
    }
    return pool;
}
async function query(text, params) {
    const start = Date.now();
    const result = await getPool().query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
        console.log(`[dbClient] query: ${text.slice(0, 80)} | rows=${result.rowCount} | ${duration}ms`);
    }
    return result;
}
async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[dbClient] Pool closed');
    }
}
process.on('SIGINT', () => closePool().finally(() => process.exit(0)));
process.on('SIGTERM', () => closePool().finally(() => process.exit(0)));
