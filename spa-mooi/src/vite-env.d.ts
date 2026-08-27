/// <reference types="vite/client" />

import type { RawEnv } from '@/config/types/RawEnv';

declare global {
  interface ImportMetaEnv extends RawEnv {}

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
