import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { webManifest } from './vite/webManifest';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Node resolves `localhost` to ::1 only; bind IPv4 loopback like the other dev services so every
  // client reaches it, the iOS Simulator's Safari included. Browsers fall back to it for `localhost`.
  const devHost = !env.VITE_DEV_HOST || env.VITE_DEV_HOST === 'localhost' ? '127.0.0.1' : env.VITE_DEV_HOST;

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
      host: devHost,
      port: Number(env.VITE_DEV_PORT || 5173),
    },
    preview: {
      port: Number(env.VITE_PREVIEW_PORT || 4173),
    },
  };
});
