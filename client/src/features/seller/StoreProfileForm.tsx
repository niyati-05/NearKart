import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import {
  createStore,
  updateMyStore,
  type StoreProfile,
} from '../../api/stores';
import { RouteMap } from '../../components/RouteMap';

interface StoreProfileFormProps {
  store: StoreProfile | null;
  onSaved: (store: StoreProfile, message: string) => void;
}

function parseCoordinate(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function validPreview(
  latitude: string,
  longitude: string,
): { latitude: number; longitude: number } | null {
  const lat = parseCoordinate(latitude);
  const lng = parseCoordinate(longitude);

  if (
    lat === null ||
    lng === null ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

export function StoreProfileForm({ store, onSaved }: StoreProfileFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(store?.name ?? '');
    setDescription(store?.description ?? '');
    setCity(store?.city ?? '');
    setLatitude(store?.location ? String(store.location.latitude) : '');
    setLongitude(store?.location ? String(store.location.longitude) : '');
    setError(null);
    setLocationMessage(null);
  }, [store]);

  const preview = validPreview(latitude, longitude);

  function handleUseCurrentLocation() {
    setLocationMessage(null);

    if (!('geolocation' in navigator)) {
      setLocationMessage(
        'This browser cannot read a location. Enter coordinates manually.',
      );
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setLocationMessage(
          'Location captured from this browser. Save the store profile to keep it.',
        );
        setLocating(false);
      },
      (geoError) => {
        setLocationMessage(
          geoError.code === geoError.PERMISSION_DENIED
            ? 'Location permission was denied. Enter coordinates manually or allow access and try again.'
            : 'Could not read this device location. Enter coordinates manually.',
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedCity = city.trim();
    const trimmedDescription = description.trim();
    const trimmedLatitude = latitude.trim();
    const trimmedLongitude = longitude.trim();

    if (trimmedName.length < 2) {
      setError('Store name must be at least 2 characters.');
      return;
    }
    if (trimmedName.length > 80) {
      setError('Store name must be 80 characters or fewer.');
      return;
    }
    if (trimmedCity.length < 2) {
      setError('Enter the city your store operates from.');
      return;
    }
    if (trimmedCity.length > 60) {
      setError('City must be 60 characters or fewer.');
      return;
    }
    if (trimmedDescription.length > 1000) {
      setError('Description must be 1000 characters or fewer.');
      return;
    }

    let location: { latitude: number; longitude: number } | null | undefined;

    if (!trimmedLatitude && !trimmedLongitude) {
      // An existing store clears its pin; a new store simply has none.
      location = store ? null : undefined;
    } else {
      const parsedLatitude = parseCoordinate(trimmedLatitude);
      const parsedLongitude = parseCoordinate(trimmedLongitude);

      if (parsedLatitude === null || parsedLongitude === null) {
        setError(
          'Enter both latitude and longitude, or leave both fields blank.',
        );
        return;
      }
      if (parsedLatitude < -90 || parsedLatitude > 90) {
        setError('Latitude must be between -90 and 90.');
        return;
      }
      if (parsedLongitude < -180 || parsedLongitude > 180) {
        setError('Longitude must be between -180 and 180.');
        return;
      }

      location = {
        latitude: Math.round(parsedLatitude * 1_000_000) / 1_000_000,
        longitude: Math.round(parsedLongitude * 1_000_000) / 1_000_000,
      };
    }

    setSubmitting(true);
    try {
      const baseInput = {
        name: trimmedName,
        description: trimmedDescription,
        city: trimmedCity,
      };

      const response = store
        ? await updateMyStore({ ...baseInput, location })
        : await createStore({
            ...baseInput,
            ...(location ? { location } : {}),
          });

      onSaved(
        response.store,
        store ? 'Store profile updated.' : 'Store created. You can add products now.',
      );
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.details?.[0]?.message ?? caught.message);
      } else {
        setError('Could not save the store profile. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="seller-card"
      id="store-profile"
      aria-labelledby="store-profile-title"
    >
      <div className="seller-card__head">
        <div>
          <p className="eyebrow eyebrow--dark">Store profile</p>
          <h2 id="store-profile-title">
            {store ? 'Your storefront' : 'Create your store'}
          </h2>
        </div>
        {store && (
          <span className={`availability availability--${store.status === 'active' ? 'in' : 'paused'}`}>
            {store.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      <p className="seller-card__intro">
        Customers see this name, city and description next to your products.
        One store is allowed per seller account.
      </p>

      <form className="seller-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="store-name">Store name</label>
          <input
            id="store-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Green Basket Grocers"
            maxLength={80}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="store-city">City</label>
          <input
            id="store-city"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            placeholder="e.g. Pune"
            maxLength={60}
            required
          />
          <span className="form-hint">
            Only the city is public. Do not enter a full home address.
          </span>
        </div>

        <fieldset className="store-location">
          <legend>Store map location</legend>
          <p className="form-hint">
            Used as the pickup point for Google Routes delivery estimates. This
            pin is public, so use the store or pickup location, not a customer
            address.
          </p>

          <div className="store-location__grid">
            <div className="form-field">
              <label htmlFor="store-latitude">Latitude</label>
              <input
                id="store-latitude"
                inputMode="decimal"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                placeholder="e.g. 18.520430"
              />
            </div>
            <div className="form-field">
              <label htmlFor="store-longitude">Longitude</label>
              <input
                id="store-longitude"
                inputMode="decimal"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                placeholder="e.g. 73.856744"
              />
            </div>
          </div>

          <div className="store-location__actions">
            <button
              className="button button--outline button--small"
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
            >
              {locating ? 'Reading location…' : 'Use current location'}
            </button>
            <span className="form-hint">
              Leave both fields blank if you do not want a map pin.
            </span>
          </div>

          {locationMessage && (
            <p className="form-hint" role="status">
              {locationMessage}
            </p>
          )}

          {preview && (
            <RouteMap
              title="Store location preview"
              origin={preview}
              height={220}
            />
          )}
        </fieldset>

        <div className="form-field">
          <label htmlFor="store-description">
            Description <span className="optional">(optional)</span>
          </label>
          <textarea
            id="store-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What does your store sell?"
            rows={4}
            maxLength={1000}
          />
          <span className="form-hint">{description.length}/1000 characters</span>
        </div>

        {store && (
          <p className="seller-slug">
            Store link slug: <code>{store.slug}</code>
          </p>
        )}

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button
          className="button button--primary"
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? 'Saving…'
            : store
              ? 'Save store profile'
              : 'Create store'}
        </button>
      </form>
    </section>
  );
}
