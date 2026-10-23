import { useEffect, useRef, useState } from 'react';
import type { GeoPoint } from '../api/maps';
import {
  isGoogleMapsConfigured,
  loadGoogleMaps,
  type GoogleMap,
  type GoogleMarker,
  type GooglePolyline,
  type LatLngLiteral,
} from '../lib/google-maps';

interface RouteMapProps {
  origin?: GeoPoint | null;
  destination?: GeoPoint | null;
  encodedPolyline?: string | null;
  title: string;
  height?: number;
}

type MapStatus = 'loading' | 'ready' | 'error' | 'unavailable';

function toLatLng(point: GeoPoint | null | undefined): LatLngLiteral | null {
  if (!point) {
    return null;
  }
  return { lat: point.latitude, lng: point.longitude };
}

export function RouteMap({
  origin: rawOrigin,
  destination: rawDestination,
  encodedPolyline,
  title,
  height = 260,
}: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const origin = toLatLng(rawOrigin);
  const destination = toLatLng(rawDestination);

  const [status, setStatus] = useState<MapStatus>(() =>
    isGoogleMapsConfigured() && (origin || destination)
      ? 'loading'
      : 'unavailable',
  );

  useEffect(() => {
    const container = containerRef.current;

    if (!isGoogleMapsConfigured() || (!origin && !destination) || !container) {
      setStatus('unavailable');
      return;
    }

    let cancelled = false;
    let map: GoogleMap | null = null;
    let markers: GoogleMarker[] = [];
    let polyline: GooglePolyline | null = null;

    setStatus('loading');

    loadGoogleMaps()
      .then((api) => {
        if (cancelled || !containerRef.current) {
          return;
        }

        const activeContainer = containerRef.current;
        const fallbackCenter = origin ?? destination!;
        map = new api.maps.Map(activeContainer, {
          center: fallbackCenter,
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          clickableIcons: false,
        });

        const bounds = new api.maps.LatLngBounds();
        let boundsPointCount = 0;

        function addMarker(point: LatLngLiteral, label: string) {
          markers.push(
            new api.maps.Marker({
              map: map ?? undefined,
              position: point,
              title: label,
            }),
          );
          bounds.extend(point);
          boundsPointCount += 1;
        }

        if (origin) {
          addMarker(origin, 'Store location');
        }
        if (destination) {
          addMarker(destination, 'Delivery address');
        }

        if (encodedPolyline && api.maps.geometry) {
          try {
            const path = api.maps.geometry.encoding.decodePath(encodedPolyline);
            if (path.length > 0) {
              polyline = new api.maps.Polyline({
                map: map ?? undefined,
                path,
                strokeColor: '#0f766e',
                strokeOpacity: 0.9,
                strokeWeight: 5,
              });
              for (const point of path) {
                bounds.extend(point);
                boundsPointCount += 1;
              }
            }
          } catch {
            // A malformed polyline should not hide the endpoint markers.
          }
        }

        if (boundsPointCount > 1) {
          map.fitBounds(bounds);
        } else {
          map.setCenter(fallbackCenter);
          map.setZoom(14);
        }

        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
      for (const marker of markers) {
        marker.setMap(null);
      }
      polyline?.setMap(null);
      markers = [];
      polyline = null;
      map = null;
      if (container) {
        container.innerHTML = '';
      }
    };
  }, [
    origin?.lat,
    origin?.lng,
    destination?.lat,
    destination?.lng,
    encodedPolyline,
  ]);

  const configured = isGoogleMapsConfigured();
  const hasPoint = Boolean(origin || destination);

  return (
    <div className="map-frame" style={{ minHeight: height }}>
      <div
        ref={containerRef}
        className="map-canvas"
        style={{ height }}
        role="img"
        aria-label={`${title} map`}
      />

      {status !== 'ready' && (
        <div className="map-overlay" role="status">
          {status === 'loading' && <span>Loading map…</span>}

          {status === 'unavailable' && !configured && (
            <>
              <strong>Map unavailable</strong>
              <span>
                Add a public <code>VITE_GOOGLE_MAPS_API_KEY</code> to
                <code> client/.env</code> to display Google Maps.
              </span>
            </>
          )}

          {status === 'unavailable' && configured && !hasPoint && (
            <>
              <strong>No map points yet</strong>
              <span>
                Save the store coordinates and enter a delivery address to show
                the route.
              </span>
            </>
          )}

          {status === 'error' && (
            <>
              <strong>Map could not load</strong>
              <span>
                Check that Maps JavaScript API is enabled and the browser key
                allows this origin.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
