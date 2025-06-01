// src/types/bun.d.ts
interface ImportMeta {
  readonly main?: boolean
}

declare const Bun: {
  serve(options: {
    fetch: (request: Request) => Response | Promise<Response>,
    port?: number,
    hostname?: string,
    tls?: {
      key: string | Buffer,
      cert: string | Buffer
    }
  }): void
};
