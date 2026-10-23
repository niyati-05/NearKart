/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base path for API calls. Defaults to `/api` (proxied by Vite in dev). */
  readonly VITE_API_BASE?: string;
  /** Public browser key for the Google Maps JavaScript API. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
