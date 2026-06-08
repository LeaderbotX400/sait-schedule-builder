/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_EXT_ID?: string;
  readonly VITE_DEMO?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
