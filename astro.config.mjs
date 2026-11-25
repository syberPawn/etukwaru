// @ts-check
import { defineConfig } from 'astro/config';
import fs from 'node:fs';

const PROJECTS = new URL('./src/data/projects.js', import.meta.url);
const TRUCK = new URL('./public/truck/', import.meta.url);

/**
 * The truck game (public/truck/) reads its projects from the same file as the
 * portfolio, src/data/projects.js. This serves that file to the game in dev,
 * copies it in at build, and serves /truck/ itself in dev.
 * @returns {import('astro').AstroIntegration}
 */
function truckData() {
  return {
    name: 'truck-data',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => updateConfig({
        vite: {
          plugins: [{
            name: 'truck-data-dev',
            configureServer(server) {
              server.middlewares.use((req, res, next) => {
                const url = (req.url ?? '').split('?')[0];
                if (url === '/truck/src/projects.js') {
                  res.setHeader('content-type', 'text/javascript');
                  res.end(fs.readFileSync(PROJECTS));
                } else if (url === '/truck/' || url === '/truck') {
                  res.setHeader('content-type', 'text/html; charset=utf-8');
                  res.end(fs.readFileSync(new URL('index.html', TRUCK)));
                } else next();
              });
            },
          }],
        },
      }),
      'astro:build:done': ({ dir }) => {
        fs.copyFileSync(PROJECTS, new URL('truck/src/projects.js', dir));
      },
    },
  };
}

export default defineConfig({
  site: 'https://etukwaru.online',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    // Every stylesheet and script is a file, never inline, so the security
    // policy can forbid inline code entirely.
    inlineStylesheets: 'never',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
  devToolbar: { enabled: false },
  integrations: [truckData()],
});
