import { QueryResult } from 'pg';
export declare function query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
export declare function closePool(): Promise<void>;
