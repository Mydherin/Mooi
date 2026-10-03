import type { Plugin } from 'vite';

const FILE_NAME = 'manifest.webmanifest';
/** Matches the dark canvas: the splash screen and the first frame of the app share one color. */
const BACKGROUND = '#000000';

interface WebManifestOptions {
  name: string;
  description: string;
}

const buildManifest = ({ name, description }: WebManifestOptions) => ({
  id: '/',
  name,
  short_name: name,
  description,
  lang: 'en',
  dir: 'ltr',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['standalone'],
  orientation: 'any',
  background_color: BACKGROUND,
  theme_color: BACKGROUND,
  categories: ['developer', 'productivity'],
  launch_handler: { client_mode: 'focus-existing' },
  prefer_related_applications: false,
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
});

/**
 * The web app manifest, generated from the same `.env` identity as the rest of the shell: served by
 * the dev server and emitted next to `index.html` on build, so the name never drifts between them.
 */
export const webManifest = (options: WebManifestOptions): Plugin => {
  const source = JSON.stringify(buildManifest(options), null, 2);

  return {
    name: 'mooi-web-manifest',
    configureServer(server) {
      server.middlewares.use(`/${FILE_NAME}`, (_request, response) => {
        response.setHeader('Content-Type', 'application/manifest+json');
        response.end(source);
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: FILE_NAME, source });
    },
  };
};
