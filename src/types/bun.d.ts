// src/types/bun.d.ts
interface ImportMeta {
  readonly main?: boolean;
}

declare const Bun: {
  serve(options: {
    fetch: (request: Request) => Response | Promise<Response>;
    port?: number;
    hostname?: string;
    tls?: {
      key: string | Buffer;
      cert: string | Buffer;
    };
  }): void;
};

// Make this file a module by adding an export
export {};

// Cloudflare Workers types
declare global {
  interface Env {
    OPEN_METEO_CACHE: KVNamespace;
    DB: D1Database;
  }

  // D1 Database types
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(
      statements: D1PreparedStatement[],
    ): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta: {
      duration: number;
      size_after: number;
      rows_read: number;
      rows_written: number;
    };
    changes: number;
    duration: number;
    last_row_id: number;
  }

  interface D1ExecResult {
    count: number;
    duration: number;
  }
}
