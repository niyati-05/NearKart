import { env } from '../../config/env.js';
import { getDb } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';
import type { GeoPoint } from '../../lib/geo.js';
import { roundGeoPoint } from '../../lib/geo.js';
import { findCart, serializeCart } from '../cart/cart.service.js';
import type { DeliveryAddress } from '../order/order.types.js';
import type { Store } from '../store/store.types.js';
import type {
  DeliveryPricing,
  DeliveryQuote,
  DeliveryQuoteReason,
  DeliveryQuoteUnavailable,
  DeliveryRouteSnapshot,
} from './delivery.types.js';

const ROUTES_API_URL =
  'https://routes.googleapis.com/directions/v2:computeRoutes';
const ROUTES_FIELD_MASK = [
  'routes.distanceMeters',
  'routes.duration',
  'routes.polyline.encodedPolyline',
  'routes.legs.startLocation',
  'routes.legs.endLocation',
].join(',');

/** Reasons where an order can still be placed with the fee left pending. */
const FALLBACK_REASONS: ReadonlySet<DeliveryQuoteReason> = new Set([
  'MAPS_NOT_CONFIGURED',
  'STORE_LOCATION_MISSING',
]);

const REASON_MESSAGES: Record<DeliveryQuoteReason, string> = {
  MAPS_NOT_CONFIGURED:
    'Delivery estimates are not available yet. Your order can still be placed, but the delivery fee will remain pending.',
  STORE_LOCATION_MISSING:
    'This store has not set a map location yet. Your order can still be placed, but the delivery fee will remain pending.',
  ADDRESS_INVALID:
    'We could not find that delivery address. Check the street, city and postal code, then try again.',
  ROUTE_NOT_FOUND:
    'No driving route was found to that delivery address. Check the address and try again.',
  ROUTE_UNAVAILABLE:
    'The delivery estimate service is unavailable right now. Please try again in a moment.',
  ROUTE_TOO_LONG:
    'That delivery address is outside this store’s delivery range.',
};

export interface DeliveryQuoteOptions {
  apiKey?: string;
  pricing?: Partial<DeliveryPricing>;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

interface ResolvedDeliveryOptions {
  apiKey: string;
  pricing: DeliveryPricing;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  now: () => Date;
}

interface RouteLatLng {
  latitude?: number;
  longitude?: number;
}

interface RoutesApiRoute {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: Array<{
    startLocation?: { latLng?: RouteLatLng };
    endLocation?: { latLng?: RouteLatLng };
  }>;
}

interface RoutesApiResponse {
  routes?: RoutesApiRoute[];
}

type RoutesApiResult =
  | { ok: true; data: RoutesApiResponse }
  | { ok: false; status: number };

function resolveOptions(options: DeliveryQuoteOptions): ResolvedDeliveryOptions {
  return {
    apiKey: options.apiKey ?? env.GOOGLE_MAPS_API_KEY,
    pricing: {
      baseFeePaise: options.pricing?.baseFeePaise ?? env.DELIVERY_BASE_FEE_PAISE,
      perKmPaise: options.pricing?.perKmPaise ?? env.DELIVERY_PER_KM_PAISE,
      perMinutePaise:
        options.pricing?.perMinutePaise ?? env.DELIVERY_PER_MINUTE_PAISE,
      minimumFeePaise:
        options.pricing?.minimumFeePaise ?? env.DELIVERY_MIN_FEE_PAISE,
      maxDistanceMeters:
        options.pricing?.maxDistanceMeters ??
        env.DELIVERY_MAX_DISTANCE_METERS,
    },
    timeoutMs: options.timeoutMs ?? env.GOOGLE_MAPS_REQUEST_TIMEOUT_MS,
    fetchImpl: options.fetchImpl ?? fetch,
    now: options.now ?? (() => new Date()),
  };
}

/**
 * Billed distance and time are rounded up to whole kilometres/minutes, then
 * the configured minimum is applied. Everything stays in integer paise.
 */
export function calculateDeliveryFeePaise(
  distanceMeters: number,
  durationSeconds: number,
  pricing: DeliveryPricing,
): number {
  const billedKilometres = Math.ceil(Math.max(0, distanceMeters) / 1000);
  const billedMinutes = Math.ceil(Math.max(0, durationSeconds) / 60);

  return Math.max(
    pricing.minimumFeePaise,
    pricing.baseFeePaise +
      billedKilometres * pricing.perKmPaise +
      billedMinutes * pricing.perMinutePaise,
  );
}

export function isDeliveryQuoteBlocking(reason: DeliveryQuoteReason): boolean {
  return !FALLBACK_REASONS.has(reason);
}

function unavailableQuote(
  reason: DeliveryQuoteReason,
  subtotalPaise: number,
  message = REASON_MESSAGES[reason],
): DeliveryQuoteUnavailable {
  return {
    status: 'unavailable',
    reason,
    message,
    subtotalPaise,
    deliveryFeePaise: 0,
    totalPaise: subtotalPaise,
    checkoutAllowed: !isDeliveryQuoteBlocking(reason),
  };
}

function composeAddress(address: DeliveryAddress): string {
  return [
    address.line1,
    address.line2,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');
}

function routeCoordinate(location: RouteLatLng | undefined): GeoPoint | null {
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return roundGeoPoint({ latitude, longitude });
}

function parseDurationSeconds(value: unknown): number | null {
  if (typeof value !== 'string' || !value.endsWith('s')) {
    return null;
  }

  const seconds = Number(value.slice(0, -1));
  return Number.isFinite(seconds) && seconds >= 0 ? Math.round(seconds) : null;
}

async function requestRoute(
  options: ResolvedDeliveryOptions,
  origin: GeoPoint,
  address: DeliveryAddress,
): Promise<RoutesApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await options.fetchImpl(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': options.apiKey,
        'X-Goog-FieldMask': ROUTES_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: origin.latitude,
              longitude: origin.longitude,
            },
          },
        },
        destination: {
          // Routes API geocodes the address as part of the route request, so
          // the customer does not have to share browser coordinates.
          address: composeAddress(address),
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: false,
        units: 'METRIC',
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return { ok: false, status: response.status };
    }

    return { ok: true, data: (await response.json()) as RoutesApiResponse };
  } catch {
    return { ok: false, status: 0 };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calculates a delivery quote for a known store and delivery address. The
 * caller supplies the server-recalculated subtotal; no client price or fee is
 * accepted.
 */
export async function quoteDeliveryForStore(
  store: Pick<Store, 'location'>,
  address: DeliveryAddress,
  subtotalPaise: number,
  options: DeliveryQuoteOptions = {},
): Promise<DeliveryQuote> {
  const settings = resolveOptions(options);
  const subtotal = Math.max(0, Math.trunc(subtotalPaise));

  if (!settings.apiKey) {
    return unavailableQuote('MAPS_NOT_CONFIGURED', subtotal);
  }

  if (!store.location) {
    return unavailableQuote('STORE_LOCATION_MISSING', subtotal);
  }

  const origin = roundGeoPoint(store.location);
  const result = await requestRoute(settings, origin, address);

  if (!result.ok) {
    if (result.status === 400) {
      return unavailableQuote('ADDRESS_INVALID', subtotal);
    }

    if (result.status === 0) {
      console.error('[nearkart-api] Routes API request failed: network error');
    } else {
      console.error(
        '[nearkart-api] Routes API request failed with status',
        result.status,
      );
    }

    return unavailableQuote('ROUTE_UNAVAILABLE', subtotal);
  }

  const route = result.data.routes?.[0];

  if (
    !route ||
    typeof route.distanceMeters !== 'number' ||
    !Number.isFinite(route.distanceMeters) ||
    route.distanceMeters < 0
  ) {
    return unavailableQuote('ROUTE_NOT_FOUND', subtotal);
  }

  if (route.distanceMeters > settings.pricing.maxDistanceMeters) {
    return unavailableQuote('ROUTE_TOO_LONG', subtotal);
  }

  const durationSeconds = parseDurationSeconds(route.duration);
  const leg = route.legs?.[0];
  const routeOrigin = routeCoordinate(leg?.startLocation?.latLng) ?? origin;
  const destination = routeCoordinate(leg?.endLocation?.latLng);

  if (durationSeconds === null || !destination) {
    return unavailableQuote('ROUTE_UNAVAILABLE', subtotal);
  }

  const distanceMeters = Math.round(route.distanceMeters);
  const deliveryFeePaise = calculateDeliveryFeePaise(
    distanceMeters,
    durationSeconds,
    settings.pricing,
  );

  const snapshot: DeliveryRouteSnapshot = {
    distanceMeters,
    durationSeconds,
    ...(route.polyline?.encodedPolyline
      ? { polyline: route.polyline.encodedPolyline }
      : {}),
    origin: routeOrigin,
    destination,
    provider: 'google_routes',
    quotedAt: settings.now(),
  };

  return {
    status: 'calculated',
    subtotalPaise: subtotal,
    deliveryFeePaise,
    totalPaise: subtotal + deliveryFeePaise,
    route: snapshot,
  };
}

/**
 * Quote endpoint helper: the store comes from the customer's own cart, never
 * from the request body, so a caller cannot quote an arbitrary store.
 */
export async function quoteCartDelivery(
  customerId: Parameters<typeof findCart>[0],
  address: DeliveryAddress,
): Promise<DeliveryQuote> {
  const cart = await findCart(customerId);

  if (!cart || cart.items.length === 0) {
    throw new AppError(
      409,
      'CART_EMPTY',
      'Add products to your cart before estimating delivery.',
    );
  }

  const publicCart = await serializeCart(cart);

  if (publicCart.hasIssues) {
    throw new AppError(
      409,
      'CART_HAS_ISSUES',
      'Fix the unavailable items in your cart before estimating delivery.',
    );
  }

  const store = await getDb()
    .collection<Store>('stores')
    .findOne({ _id: cart.storeId });

  if (!store || store.status !== 'active') {
    throw new AppError(
      409,
      'STORE_UNAVAILABLE',
      'This store is not accepting orders right now.',
    );
  }

  return quoteDeliveryForStore(store, address, publicCart.subtotalPaise);
}
