import type { GeoPoint } from '../../lib/geo.js';

export const deliveryQuoteReasons = [
  'MAPS_NOT_CONFIGURED',
  'STORE_LOCATION_MISSING',
  'ADDRESS_INVALID',
  'ROUTE_NOT_FOUND',
  'ROUTE_UNAVAILABLE',
  'ROUTE_TOO_LONG',
] as const;

export type DeliveryQuoteReason = (typeof deliveryQuoteReasons)[number];

/** Server-owned pricing rules, all in integer paise. */
export interface DeliveryPricing {
  baseFeePaise: number;
  perKmPaise: number;
  perMinutePaise: number;
  minimumFeePaise: number;
  maxDistanceMeters: number;
}

export interface DeliveryRouteSnapshot {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  origin: GeoPoint;
  destination: GeoPoint;
  provider: 'google_routes';
  quotedAt: Date;
}

export interface DeliveryQuoteCalculated {
  status: 'calculated';
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  route: DeliveryRouteSnapshot;
}

export interface DeliveryQuoteUnavailable {
  status: 'unavailable';
  reason: DeliveryQuoteReason;
  message: string;
  subtotalPaise: number;
  deliveryFeePaise: 0;
  totalPaise: number;
  /**
   * False when the customer must fix the address or retry before checkout.
   * True when Maps/store setup is incomplete and an order can still be placed
   * with the delivery fee explicitly pending.
   */
  checkoutAllowed: boolean;
}

export type DeliveryQuote = DeliveryQuoteCalculated | DeliveryQuoteUnavailable;
