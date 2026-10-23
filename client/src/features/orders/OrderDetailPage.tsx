import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { getOrder, type CustomerOrder } from '../../api/orders';
import { RouteMap } from '../../components/RouteMap';
import { formatDateTime } from '../../lib/date';
import { formatDistance, formatDuration } from '../../lib/delivery';
import { formatPaise } from '../../lib/money';
import { OrderStatusBadge } from './OrderStatusBadge';

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not load this order. Check that the API is running.';
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const justPlaced = Boolean(
    (location.state as { justPlaced?: boolean } | null)?.justPlaced,
  );
  const [order, setOrder] = useState<CustomerOrder | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setStatus('error');
      setError('This order link is missing an id.');
      setErrorStatus(400);
      return;
    }

    setStatus('loading');
    setError(null);
    setErrorStatus(null);

    getOrder(id)
      .then((response) => {
        if (!cancelled) {
          setOrder(response.order);
          setStatus('ready');
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setStatus('error');
          setError(describeError(caught));
          setErrorStatus(caught instanceof ApiError ? caught.status : null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (status === 'loading') {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card" role="status">
            <h1>Loading order…</h1>
            <p>Reading the order from your account.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !order) {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card state-card--error" role="alert">
            <h1>
              {errorStatus === 404 ? 'Order not found' : 'Could not load order'}
            </h1>
            <p>
              {errorStatus === 404
                ? 'This order does not exist on your account, or the link is wrong.'
                : (error ?? 'Please try again.')}
            </p>
            <div className="state-card__actions">
              <Link className="button button--primary" to="/orders">
                My orders
              </Link>
              {errorStatus !== 404 && (
                <button
                  className="button button--outline"
                  type="button"
                  onClick={() => setReloadToken((token) => token + 1)}
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="commerce-page">
      <div className="container commerce-page__inner">
        {justPlaced && (
          <div className="seller-alert seller-alert--success" role="status">
            <strong>Order placed</strong>
            <p>
              {order.orderNumber} was saved. Stock has been updated and the
              seller can now confirm it.
            </p>
          </div>
        )}

        <header className="commerce-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Order details</p>
            <h1>{order.orderNumber}</h1>
            <p>
              Placed {formatDateTime(order.placedAt)} · {order.store.name}
            </p>
          </div>
          <div className="commerce-page__head-actions">
            <OrderStatusBadge status={order.status} />
            <Link className="button button--outline" to="/orders">
              My orders
            </Link>
          </div>
        </header>

        <div className="order-detail-layout">
          <div className="order-detail-main">
            <section className="checkout-card">
              <h2>Items</h2>
              <div className="order-item-list">
                {order.items.map((item) => (
                  <div className="order-item" key={item.productId}>
                    <div>
                      <Link
                        className="order-item__name"
                        to={`/marketplace/${item.productId}`}
                      >
                        {item.name}
                      </Link>
                      <span>
                        {item.quantity} × {formatPaise(item.pricePaise)}
                      </span>
                    </div>
                    <strong>{formatPaise(item.lineTotalPaise)}</strong>
                  </div>
                ))}
              </div>

              <dl className="checkout-totals">
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatPaise(order.subtotalPaise)}</dd>
                </div>
                <div>
                  <dt>Delivery fee</dt>
                  <dd
                    className={
                      order.deliveryFeeStatus === 'pending_maps_integration'
                        ? 'cart-summary__pending'
                        : undefined
                    }
                  >
                    {order.deliveryFeeStatus === 'pending_maps_integration'
                      ? 'Pending Maps setup'
                      : formatPaise(order.deliveryFeePaise)}
                  </dd>
                </div>
                <div className="checkout-totals__total">
                  <dt>
                    {order.deliveryFeeStatus === 'calculated'
                      ? 'Total (including delivery)'
                      : 'Total (excluding delivery)'}
                  </dt>
                  <dd>{formatPaise(order.totalPaise)}</dd>
                </div>
              </dl>
              <p className="checkout-card__note">
                {order.deliveryFeeStatus === 'calculated'
                  ? 'The delivery fee was calculated from the Google Routes road distance and drive time when this order was placed.'
                  : (order.deliveryQuoteMessage ??
                    'No delivery cost has been estimated or charged. The total shown is the stored product subtotal.')}
              </p>
            </section>

            {order.deliveryRoute && (
              <section className="checkout-card">
                <h2>Delivery route</h2>
                <p className="checkout-card__intro">
                  Road route from the store to this delivery address, stored
                  when the order was placed.
                </p>

                <div className="delivery-quote">
                  <RouteMap
                    title="Delivery route"
                    origin={order.deliveryRoute.origin}
                    destination={order.deliveryRoute.destination}
                    encodedPolyline={order.deliveryRoute.polyline}
                    height={280}
                  />

                  <dl className="delivery-quote__stats">
                    <div>
                      <dt>Road distance</dt>
                      <dd>
                        {formatDistance(order.deliveryRoute.distanceMeters)}
                      </dd>
                    </div>
                    <div>
                      <dt>Estimated drive</dt>
                      <dd>
                        {formatDuration(order.deliveryRoute.durationSeconds)}
                      </dd>
                    </div>
                    <div>
                      <dt>Delivery fee</dt>
                      <dd>{formatPaise(order.deliveryFeePaise)}</dd>
                    </div>
                  </dl>
                </div>
              </section>
            )}

            {!order.deliveryRoute && order.deliveryQuoteMessage && (
              <section className="checkout-card">
                <h2>Delivery estimate</h2>
                <div className="seller-alert seller-alert--warning" role="status">
                  <strong>Delivery fee pending</strong>
                  <p>{order.deliveryQuoteMessage}</p>
                </div>
              </section>
            )}

            <section className="checkout-card">
              <h2>Status history</h2>
              <ol className="status-timeline">
                {order.statusHistory.map((entry, index) => (
                  <li key={`${entry.status}-${entry.changedAt}-${index}`}>
                    <OrderStatusBadge status={entry.status} />
                    <div>
                      <p>{formatDateTime(entry.changedAt)}</p>
                      <span>
                        Updated by {entry.changedByRole}
                        {entry.note ? ` · ${entry.note}` : ''}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <aside className="order-detail-aside">
            <section className="checkout-card">
              <h2>Delivery address</h2>
              <address className="delivery-address">
                <strong>{order.deliveryAddress.fullName}</strong>
                <span>{order.deliveryAddress.phone}</span>
                <span>{order.deliveryAddress.line1}</span>
                {order.deliveryAddress.line2 && (
                  <span>{order.deliveryAddress.line2}</span>
                )}
                <span>
                  {order.deliveryAddress.city}, {order.deliveryAddress.state}{' '}
                  {order.deliveryAddress.postalCode}
                </span>
                <span>{order.deliveryAddress.country}</span>
              </address>
            </section>

            <section className="checkout-card">
              <h2>Store</h2>
              <p className="checkout-card__intro">
                <strong>{order.store.name}</strong>
                <br />
                {order.store.city}
              </p>
              <p className="checkout-card__secure">
                Only you and the seller can access this order. The seller sees
                the contact and delivery area, not your full street address.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
