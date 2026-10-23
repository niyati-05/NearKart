import { useApiHealth } from '../hooks/useApiHealth';

export function HealthBadge() {
  const health = useApiHealth();

  const label =
    health.status === 'checking'
      ? 'Checking API'
      : health.status === 'online'
        ? health.data.database.status === 'connected'
          ? 'API · DB online'
          : 'API online · DB down'
        : 'API offline';

  const tone =
    health.status === 'online' && health.data.database.status !== 'connected'
      ? 'degraded'
      : health.status;

  const title =
    health.status === 'online'
      ? `${health.data.service} v${health.data.version} · database ${health.data.database.status}`
      : health.status === 'offline'
        ? 'Start the backend: npm run dev in the server folder.'
        : 'Contacting /api/health';

  return (
    <span className={`health health--${tone}`} role="status" title={title}>
      <span className="health__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
