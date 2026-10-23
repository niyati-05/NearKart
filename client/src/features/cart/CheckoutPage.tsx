import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  getDeliveryQuote,
  isBlockingQuoteReason,
  type DeliveryQuote,
} from '../../api/delivery';
import {
  placeOrder,
  type DeliveryAddress,
} from '../../api/orders';
import { useAuth } from '../../auth/AuthProvider';
import { RouteMap } from '../../components/RouteMap';
import { formatDistance, formatDuration } from '../../lib/delivery';
import { formatPaise } from '../../lib/money';
import { useCart } from '../cart/CartProvider';

interface CheckoutForm {
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not reach the API. Check that the backend is running and try again.';
}

function validateForm(form: CheckoutForm): string | null {
  if (form.fullName.trim().length < 2) {
    return 'Enter the full name for this delivery.';
  }
  if (form.phone.trim().length < 7) {
    return 'Enter a contact phone number.';
  }
  if (form.line1.trim().length < 3) {
    return 'Enter the street address.';
  }
  if (form.city.trim().length < 2) {
    return 'Enter the city.';
  }
  if (form.state.trim().length < 2) {
    return 'Enter the state.';
  }
  if (!/^\d{5,6}$/.test(form.postalCode.trim())) {
    return 'Enter a valid postal code.';
  }
  if (form.country.trim().length < 2) {
    return 'Enter the country.';
  }
  return null;
}

function buildDeliveryAddress(form: CheckoutForm): DeliveryAddress {
  return {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    line1: form.line1.trim(),
    ...(form.line2.trim() ? { line2: form.line2.trim() } : {}),
    city: form.city.trim(),
    state: form.state.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim(),
  };
}

export function CheckoutPage() {
  const { user } = useAuth();
  const { cart, loading, error, refresh } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState<CheckoutForm>({
    fullName: user?.fullName ?? '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  function updateField(field: keyof CheckoutForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    // Any address change invalidates the previous route and fee.
    setQuote(null);
    setQuoteError(null);
  }

  async function handleCalculateQuote() {
    setFormError(null);
    setQuoteError(null);

    if (!cart || cart.items.length === 0) {
      setQuoteError('Your cart is empty.');
      return;
    }

    const validationError = validateForm(form);
    if (validationError) {
      setQuoteError(validationError);
      return;
    }

    setQuoteLoading(true);
    try {
      const response = await getDeliveryQuote(buildDeliveryAddress(form));
      setQuote(response.quote);
    } catch (caught) {
      setQuote(null);
      setQuoteError(describeError(caught));
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setActionError(null);

    if (!cart || cart.items.length === 0) {
      setActionError('Your cart is empty.');
      return;
    }

    if (cart.hasIssues) {
      setActionError('Fix the unavailable items in your cart before ordering.');
      return;
    }

    if (
      quote?.status === 'unavailable' &&
      isBlockingQuoteReason(quote.reason)
    ) {
      setActionError(quote.message);
      return;
    }

    const validationError = validateForm(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const response = await placeOrder({
        idempotencyKey,
        deliveryAddress: buildDeliveryAddress(form),
      });

      void refresh().catch(() => undefined);
      navigate(`/orders/${response.order.id}`, {
        replace: true,
        state: { justPlaced: true },
      });
    } catch (caught) {
      setActionError(describeError(caught));
      if (
        caught instanceof ApiError &&
        ['CART_EMPTY', 'INSUFFICIENT_STOCK', 'PRICE_CHANGED', 'PRODUCT_UNAVAILABLE'].includes(
          caught.code,
        )
      ) {
        void refresh().catch(() => undefined);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !cart) {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card" role="status">
            <h1>Preparing checkout…</h1>
            <p>Reading your cart and current product prices.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error && !cart) {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card state-card--error" role="alert">
            <h1>Could not load checkout</h1>
            <p>{error}</p>
            <button
              className="button button--outline"
              type="button"
              onClick={() => void refresh().catch(() => undefined)}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card">
            <h1>Your cart is empty</h1>
            <p>Add products to your cart before starting checkout.</p>
            <div className="state-card__actions">
              <Link className="button button--primary" to="/marketplace">
                Browse marketplace
              </Link>
              <Link className="button button--outline" to="/cart">
                View cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const calculatedQuote = quote?.status === 'calculated' ? quote : null;
  const quoteBlocksCheckout =
    quote?.status === 'unavailable' &&
    isBlockingQuoteReason(quote.reason);
  const displayTotal = calculatedQuote
    ? calculatedQuote.totalPaise
    : cart.subtotalPaise;

  return (
    <div className="commerce-page">
      <div className="container commerce-page__inner">
        <header className="commerce-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Checkout</p>
            <h1>Confirm your order</h1>
            <p>
              The server recalculates every price, stock quantity and delivery
              estimate from MongoDB when you place the order. A Google Routes
              estimate appears when the store has a map location and the
              delivery address can be routed.
            </p>
          </div>
          <Link className="button button--outline" to="/cart">
            Back to cart
          </Link>
        </header>

        {actionError && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Order not placed</strong>
            <p>{actionError}</p>
          </div>
        )}

        {cart.hasIssues && (
          <div className="seller-alert seller-alert--warning" role="alert">
            <strong>Some cart items are unavailable</strong>
            <p>
              Reduce the requested quantity or remove unavailable products
              before placing the order.
            </p>
          </div>
        )}

        <div className="checkout-layout">
          <form className="checkout-form" onSubmit={handleSubmit} noValidate>
            <section className="checkout-card">
              <h2>Delivery details</h2>
              <p className="checkout-card__intro">
                We use these details only for this order. Sellers see the
                contact and area needed to prepare it; the full street address
                remains private to you and the future delivery assignment.
              </p>

              <div className="checkout-form__grid">
                <label className="form-field checkout-form__wide">
                  <span>Full name</span>
                  <input
                    type="text"
                    name="fullName"
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(event) =>
                      updateField('fullName', event.target.value)
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Phone</span>
                  <input
                    type="tel"
                    name="phone"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(event) =>
                      updateField('phone', event.target.value)
                    }
                    placeholder="+91 98765 43210"
                    required
                  />
                </label>

                <label className="form-field checkout-form__wide">
                  <span>Address line 1</span>
                  <input
                    type="text"
                    name="line1"
                    autoComplete="address-line1"
                    value={form.line1}
                    onChange={(event) =>
                      updateField('line1', event.target.value)
                    }
                    placeholder="House / building and street"
                    required
                  />
                </label>

                <label className="form-field checkout-form__wide">
                  <span>Address line 2 (optional)</span>
                  <input
                    type="text"
                    name="line2"
                    autoComplete="address-line2"
                    value={form.line2}
                    onChange={(event) =>
                      updateField('line2', event.target.value)
                    }
                    placeholder="Landmark, apartment or area"
                  />
                </label>

                <label className="form-field">
                  <span>City</span>
                  <input
                    type="text"
                    name="city"
                    autoComplete="address-level2"
                    value={form.city}
                    onChange={(event) =>
                      updateField('city', event.target.value)
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  <span>State</span>
                  <input
                    type="text"
                    name="state"
                    autoComplete="address-level1"
                    value={form.state}
                    onChange={(event) =>
                      updateField('state', event.target.value)
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Postal code</span>
                  <input
                    type="text"
                    name="postalCode"
                    autoComplete="postal-code"
                    inputMode="numeric"
                    value={form.postalCode}
                    onChange={(event) =>
                      updateField('postalCode', event.target.value)
                    }
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Country</span>
                  <input
                    type="text"
                    name="country"
                    autoComplete="country-name"
                    value={form.country}
                    onChange={(event) =>
                      updateField('country', event.target.value)
                    }
                    required
                  />
                </label>
              </div>

              {formError && (
                <p className="form-error" role="alert">
                  {formError}
                </p>
              )}
            </section>

            <section className="checkout-card">
              <div className="checkout-card__head">
                <div>
                  <h2>Delivery route and estimate</h2>
                  <p className="checkout-card__intro">
                    The server asks Google Routes for the road distance and
                    drive time from the store to this address. The fee uses the
                    platform pricing rules and is recalculated again when the
                    order is placed.
                  </p>
                </div>
              </div>

              <div className="delivery-estimate__actions">
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => void handleCalculateQuote()}
                  disabled={quoteLoading || cart.hasIssues}
                >
                  {quoteLoading
                    ? 'Calculating…'
                    : quote
                      ? 'Recalculate estimate'
                      : 'Calculate delivery estimate'}
                </button>
                <span className="delivery-estimate__hint">
                  Uses the store location saved by the seller.
                </span>
              </div>

              {quoteError && (
                <p className="form-error" role="alert">
                  {quoteError}
                </p>
              )}

              {calculatedQuote && (
                <div className="delivery-quote">
                  <RouteMap
                    title="Delivery route"
                    origin={{
                      latitude: calculatedQuote.route.origin.latitude,
                      longitude: calculatedQuote.route.origin.longitude,
                    }}
                    destination={{
                      latitude: calculatedQuote.route.destination.latitude,
                      longitude: calculatedQuote.route.destination.longitude,
                    }}
                    encodedPolyline={calculatedQuote.route.polyline}
                    height={280}
                  />

                  <dl className="delivery-quote__stats">
                    <div>
                      <dt>Road distance</dt>
                      <dd>
                        {formatDistance(calculatedQuote.route.distanceMeters)}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated drive</dt>
                      <dd>
                        {formatDuration(calculatedQuote.route.durationSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt>Delivery fee</dt>
                      <dd>{formatPaise(calculatedQuote.deliveryFeePaise)}</dd>
                    </div>
                  </dl>
                </div>
              )}

              {quote?.status === 'unavailable' && (
                <div
                  className={
                    isBlockingQuoteReason(quote.reason)
                      ? 'seller-alert seller-alert--error'
                      : 'seller-alert seller-alert--warning'
                  }
                  role="status"
                >
                  <strong>
                    {isBlockingQuoteReason(quote.reason)
                      ? 'Delivery estimate failed'
                      : 'Delivery estimate unavailable'}
                  </strong>
                  <p>{quote.message}</p>
                </div>
              )}
            </section>

            <section className="checkout-card">
              <div className="checkout-card__head">
                <div>
                  <h2>Items from {cart.store?.name ?? 'this store'}</h2>
                  <p className="checkout-card__intro">
                    {cart.itemCount}{' '}
                    {cart.itemCount === 1 ? 'item' : 'items'} in this cart.
                  </p>
                </div>
                <Link className="checkout-card__edit" to="/cart">
                  Edit cart
                </Link>
              </div>

              <div className="checkout-items">
                {cart.items.map((item) => (
                  <div className="checkout-item" key={item.productId}>
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        {item.quantity} × {formatPaise(item.pricePaise)}
                      </span>
                      {item.issue && (
                        <small className="checkout-item__issue">
                          {item.issue}
                        </small>
                      )}
                    </div>
                    <span>{formatPaise(item.lineTotalPaise)}</span>
                  </div>
                ))}
              </div>

              <dl className="checkout-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPaise(cart.subtotalPaise)}</dd>
                </div>
                <div>
                  <dt>Delivery fee</dt>
                  <dd className={!calculatedQuote ? 'cart-summary__pending' : undefined}>
                    {calculatedQuote
                      ? formatPaise(calculatedQuote.deliveryFeePaise)
                      : quoteBlocksCheckout
                        ? 'Not available'
                        : 'Pending Maps setup'}
                  </dd>
                </div>
                <div className="checkout-totals__total">
                  <dt>
                    {calculatedQuote
                      ? 'Total (including delivery)'
                      : 'Total (excluding delivery)'}
                  </dt>
                  <dd>{formatPaise(displayTotal)}</dd>
                </div>
              </dl>

              <p className="checkout-card__note">
                {calculatedQuote
                  ? 'This is an estimate. The server recalculates the route and fee when the order is created, and the saved order shows the final amount.'
                  : quote?.status === 'unavailable'
                    ? quote.message
                    : 'Calculate an estimate above to include the delivery fee. Without an available estimate the order keeps the delivery fee explicitly pending.'}
              </p>

              <button
                className="button button--primary checkout-submit"
                type="submit"
                disabled={
                  submitting ||
                  cart.hasIssues ||
                  quoteLoading ||
                  quoteBlocksCheckout
                }
              >
                {submitting ? 'Placing order…' : 'Place order'}
              </button>
              <p className="checkout-card__secure">
                Duplicate submissions are prevented with an idempotency key.
                Stock is reserved with atomic updates before the order is
                created.
              </p>
            </section>
          </form>

          <aside className="checkout-aside">
            <h2>Payment</h2>
            <p>
              Online payments are not part of this phase. Place the order to
              create a real order record; no payment is collected.
            </p>
            <h2>Map and delivery fee</h2>
            <p>
              Maps appear only when the browser Google Maps key is configured.
              Route distances and fees come from the server’s Google Routes key,
              which is never sent to this page.
            </p>
            <h2>Need help?</h2>
            <p>
              If stock or a price changed while you were shopping, the server
              will reject the order and leave your cart intact so you can
              review it.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
