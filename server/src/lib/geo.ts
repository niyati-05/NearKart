import { z } from 'zod';

/** A WGS84 point stored in MongoDB for stores and delivery addresses. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Coordinates come from sellers (store pin) or the Google Routes response
 * (geocoded delivery address). Validation keeps malformed points out of the
 * database and out of the Routes request.
 */
export const geoPointSchema = z.object({
  latitude: z
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
});

/** Six decimal places is roughly 0.11 m, enough for a store or doorstep pin. */
export function roundGeoPoint(point: GeoPoint): GeoPoint {
  return {
    latitude: Math.round(point.latitude * 1_000_000) / 1_000_000,
    longitude: Math.round(point.longitude * 1_000_000) / 1_000_000,
  };
}
