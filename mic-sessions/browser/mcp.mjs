// Use the Chromium revision shipped with the pinned Playwright dependency.
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH = fileURLToPath(new URL('.browsers/', import.meta.url));
const { chromium } = await import('playwright');
const cli = new URL('node_modules/@playwright/mcp/cli.js', import.meta.url);
process.argv = [process.argv[0], fileURLToPath(cli),
  '--headless', '--isolated', '--no-sandbox', '--allow-unrestricted-file-access',
  '--executable-path', chromium.executablePath(), ...process.argv.slice(2)];
await import(cli.href);
