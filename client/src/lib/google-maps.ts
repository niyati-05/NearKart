/**
 * A tiny, typed wrapper around the Google Maps JavaScript API.
 *
 * Only the browser-side key is read here. The server Routes API key is never
 * part of the client bundle.
 */

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface GoogleLatLngBounds {
  extend(point: LatLngLiteral): void;
}

export interface GoogleMap {
  fitBounds(bounds: GoogleLatLngBounds): void;
  setCenter(center: LatLngLiteral): void;
  setZoom(zoom: number): void;
}

export interface GoogleMarker {
  setMap(map: GoogleMap | null): void;
}

export interface GooglePolyline {
  setMap(map: GoogleMap | null): void;
}

interface GoogleMapOptions {
  center?: LatLngLiteral;
  zoom?: number;
  mapTypeControl?: boolean;
  streetViewControl?: boolean;
  fullscreenControl?: boolean;
  clickableIcons?: boolean;
}

interface GoogleMarkerOptions {
  map?: GoogleMap;
  position: LatLngLiteral;
  title?: string;
}

interface GooglePolylineOptions {
  map?: GoogleMap;
  path: LatLngLiteral[];
  strokeColor?: string;
  strokeOpacity?: number;
  strokeWeight?: number;
}

export interface GoogleMapsApi {
  maps: {
    Map: new (element: HTMLElement, options?: GoogleMapOptions) => GoogleMap;
    Marker: new (options?: GoogleMarkerOptions) => GoogleMarker;
    Polyline: new (options?: GooglePolylineOptions) => GooglePolyline;
    LatLngBounds: new () => GoogleLatLngBounds;
    geometry?: {
      encoding: {
        decodePath(encoded: string): LatLngLiteral[];
      };
    };
  };
}

type GoogleWindow = Window & { google?: GoogleMapsApi };

const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '').trim();
let loadPromise: Promise<GoogleMapsApi> | null = null;

export function isGoogleMapsConfigured(): boolean {
  return apiKey.length > 0;
}

function existingMapsApi(): GoogleMapsApi | null {
  const candidate = (window as GoogleWindow).google;
  return candidate?.maps ? candidate : null;
}

/**
 * Loads the Maps JS script once. The `geometry` library decodes the route
 * polyline returned by the server's Routes API request.
 */
export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  const existing = existingMapsApi();
  if (existing) {
    return Promise.resolve(existing);
  }

  if (!apiKey) {
    return Promise.reject(
      new Error(
        'Google Maps is not configured. Add VITE_GOOGLE_MAPS_API_KEY to client/.env.',
      ),
    );
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const parameters = new URLSearchParams({
      key: apiKey,
      v: 'weekly',
      libraries: 'geometry',
      loading: 'async',
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${parameters.toString()}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const api = existingMapsApi();
      if (api) {
        resolve(api);
        return;
      }
      loadPromise = null;
      reject(new Error('Google Maps loaded without a maps namespace.'));
    };

    script.onerror = () => {
      loadPromise = null;
      reject(
        new Error(
          'Could not load Google Maps. Check the browser key and enabled APIs.',
        ),
      );
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}
