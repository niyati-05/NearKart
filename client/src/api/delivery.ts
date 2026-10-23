import { apiRequest } from './client';
import type { GeoPoint, DeliveryRoute } from './maps';
import type { DeliveryAddress } from './orders';

export type DeliveryQuoteReason =
  | 'MAPS_NOT_CONFIGURED'
  | 'STORE_LOCATION_MISSING'
  | 'ADDRESS_INVALID'
  | 'ROUTE_NOT_FOUND'
  | 'ROUTE_UNAVAILABLE'
  | 'ROUTE_TOO_LONG';

export interface DeliveryQuoteCalculated {
  status: 'calculated';
  subtotalPaise: number;
  deliveryFeePaise: number;
  totalPaise: number;
  route: DeliveryRoute;
}

export interface DeliveryQuoteUnavailable {
  status: 'unavailable';
  reason: DeliveryQuoteReason;
  message: string;
  subtotalPaise: number;
  deliveryFeePaise: 0;
  totalPaise: number;
  checkoutAllowed: boolean;
}

export type DeliveryQuote = DeliveryQuoteCalculated | DeliveryQuoteUnavailable;

interface DeliveryQuoteResponse {
  quote: DeliveryQuote;
}

/**
 * The server derives the store from the signed-in customer's cart. Only the
 * address text is sent; coordinates and the fee are never supplied by the
 * browser.
 */
export function getDeliveryQuote(
  deliveryAddress: DeliveryAddress,
): Promise<DeliveryQuoteResponse> {
  return apiRequest<DeliveryQuoteResponse>('/delivery/quote', {
    method: 'POST',
    body: JSON.stringify({ deliveryAddress }),
  });
}

/** Reasons that must be fixed before checkout is allowed. */
export function isBlockingQuoteReason(reason: DeliveryQuoteReason): boolean {
  return reason !== 'MAPS_NOT_CONFIGURED' && reason !== 'STORE_LOCATION_MISSING';
}

/** Re-exported so components can use a single maps type import. */
export type { GeoPoint };
