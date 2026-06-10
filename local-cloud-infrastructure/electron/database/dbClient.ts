import { Pool, PoolConfig, QueryResult } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });


const poolConfig: PoolConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  user: process.env.DB_USER ?? 'localcloud',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME ?? 'localcloud_db',
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: false,
};


let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      console.error('[dbClient] Unexpected pool error:', err);
    });

    pool.on('connect', () => {
      console.log('[dbClient] New pg connection established');
    });
  }
  return pool;
}


export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  const result = await getPool().query<T>(text, params);
  const duration = Date.now() - start;

  if (process.env.NODE_ENV === 'development') {
    console.log(`[dbClient] query: ${text.slice(0, 80)} | rows=${result.rowCount} | ${duration}ms`);
  }

  return result;
}


export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('[dbClient] Pool closed');
  }
}

process.on('SIGINT', () => closePool().finally(() => process.exit(0)));
process.on('SIGTERM', () => closePool().finally(() => process.exit(0)));
