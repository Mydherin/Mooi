import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { webManifest } from './vite/webManifest';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      webManifest({ name: env.VITE_APP_NAME || 'Mooi', description: env.VITE_APP_DESCRIPTION || '' }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: env.VITE_DEV_HOST || 'localhost',
      port: Number(env.VITE_DEV_PORT || 5173),
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || 4173),
    },
  };
});
