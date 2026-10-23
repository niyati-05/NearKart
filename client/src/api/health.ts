export type DatabaseStatus = 'connected' | 'disconnected' | 'error';

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  database: {
    status: DatabaseStatus;
  };
  backend: {
    status: 'ok';
  };
}

const baseUrl = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/+$/, '');

/**
 * Calls the real backend health endpoint. There is no mock fallback: if the
 * server is down, the UI reports it as offline instead of pretending.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${baseUrl}/health`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
}
