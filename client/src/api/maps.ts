/** Coordinates returned by the server for stores and delivery routes. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface DeliveryRoute {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  origin: GeoPoint;
  destination: GeoPoint;
  provider: 'google_routes';
  quotedAt: string;
}

export interface DeliveryRouteSummary {
  distanceMeters: number;
  durationSeconds: number;
}
