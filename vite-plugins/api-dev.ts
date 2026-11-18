/**
 * Sirve las funciones de `api/*.ts` desde el servidor de desarrollo de Vite,
 * con la misma firma web que usa Vercel (`export function GET(req: Request)`).
 * Las variables de `.env` se cargan solo en el proceso de Node (nunca al cliente).
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, type Plugin } from 'vite';

type Handler = (req: Request) => Promise<Response> | Response;

export function apiDevPlugin(): Plugin {
  return {
    name: 'erasmus-eats-api-dev',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv(server.config.mode, server.config.root, '');
      for (const k of ['USDA_API_KEY']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }

      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = /^\/api\/([a-z0-9-]+)$/.exec(url.pathname);
        if (!match) return next();
        const file = resolve(server.config.root, 'api', `${match[1]}.ts`);
        if (!existsSync(file)) return next();
        try {
          const mod = (await server.ssrLoadModule(file)) as Partial<Record<string, Handler>>;
          const handler = mod[req.method ?? 'GET'];
          if (!handler) {
            res.statusCode = 405;
            return res.end();
          }
          const response = await handler(new Request(url, { method: req.method }));
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          server.config.logger.error(String(e));
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'dev_handler_error' }));
        }
      });
    },
  };
}
