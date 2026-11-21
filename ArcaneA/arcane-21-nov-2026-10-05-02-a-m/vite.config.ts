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
      tailwindcss(),
      {
        name: 'fix-aistudio-asset-paths',
        apply: 'build',
        transform(code: string, id: string) {
          if (id.includes('node_modules')) return null;
          let updated = code;
          if (updated.includes('/public/assets/')) {
            updated = updated.replace(/(["'`(])\/public\/assets\//g, '$1/ArcaneA/assets/');
          }
          if (updated.includes('/src/assets/')) {
            updated = updated.replace(/(["'`(])\/src\/assets\//g, '$1/ArcaneA/src/assets/');
          }
          return updated !== code ? updated : null;
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
