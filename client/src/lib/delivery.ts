/** Human-readable road distance from the Routes API value in metres. */
export function formatDistance(distanceMeters: number): string {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
    return 'Unknown distance';
  }

  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  }

  const kilometres = distanceMeters / 1000;
  return `${kilometres.toFixed(kilometres < 10 ? 1 : 0)} km`;
}

/** Human-readable drive time from the Routes API value in seconds. */
export function formatDuration(durationSeconds: number): string {
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return 'Unknown duration';
  }

  const minutes = Math.max(1, Math.round(durationSeconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} hr` : `${hours} hr ${remainder} min`;
}
