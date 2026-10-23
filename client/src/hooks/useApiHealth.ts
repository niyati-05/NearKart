import { useEffect, useState } from 'react';
import { fetchHealth, type HealthResponse } from '../api/health';

export type ApiHealthState =
  | { status: 'checking' }
  | { status: 'online'; data: HealthResponse }
  | { status: 'offline' };

/** Checks the API once on mount. Honest by design: no retry loop, no fake success. */
export function useApiHealth(): ApiHealthState {
  const [state, setState] = useState<ApiHealthState>({ status: 'checking' });

  useEffect(() => {
    const controller = new AbortController();

    fetchHealth(controller.signal)
      .then((data) => setState({ status: 'online', data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setState({ status: 'offline' });
      });

    return () => controller.abort();
  }, []);

  return state;
}
