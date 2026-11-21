import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: '/ArcaneA/',
    plugins: [
      react(),
      {
      name: 'dev-public-assets-redirect',
      apply: 'serve',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url && req.url.startsWith('/public/assets/')) {
            req.url = req.url.replace(/^\/public\/assets\//, '/ArcaneA/assets/');
          }
          next();
        });
      },
    },
      tailwindcss(),
      {
        name: 'fix-aistudio-asset-paths',
        apply: 'build',
        generateBundle(_options, bundle) {
          for (const fileName of Object.keys(bundle)) {
            const chunk = bundle[fileName];
            if (chunk.type === 'chunk' && chunk.code.includes('/public/assets/')) {
              chunk.code = chunk.code.split('/public/assets/').join('/ArcaneA/assets/');
            }
          }
        },
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
