/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  // add more if needed later
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
