import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  getOrders,
  type CustomerOrder,
  type OrderListResponse,
} from '../../api/orders';
import { formatDate } from '../../lib/date';
import { formatDistance } from '../../lib/delivery';
import { formatPaise } from '../../lib/money';
import { OrderStatusBadge } from './OrderStatusBadge';

const PAGE_SIZE = 20;

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not load your orders. Check that the API is running.';
}

function itemsSummary(order: CustomerOrder): string {
  const first = order.items[0];
  if (!first) {
    return 'No items';
  }
  if (order.items.length === 1) {
    return `${first.quantity} × ${first.name}`;
  }
  return `${first.name} and ${order.items.length - 1} more`;
}

export function OrdersPage() {
  const [result, setResult] =
    useState<OrderListResponse<CustomerOrder> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getOrders(page, PAGE_SIZE)
      .then((response) => {
        if (!cancelled) {
          setResult(response);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(describeError(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, reloadToken]);

  return (
    <div className="commerce-page">
      <div className="container commerce-page__inner">
        <header className="commerce-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Customer account</p>
            <h1>My orders</h1>
            <p>
              Every order below belongs to your account. Prices are the
              purchase-time snapshots stored in MongoDB, not current listing
              prices.
            </p>
          </div>
          <div className="commerce-page__head-actions">
            <Link className="button button--outline" to="/marketplace">
              Browse marketplace
            </Link>
            <Link className="button button--outline" to="/cart">
              View cart
            </Link>
          </div>
        </header>

        {error && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Could not load orders</strong>
            <p>{error}</p>
            <button
              className="button button--outline button--small"
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Try again
            </button>
          </div>
        )}

        {loading && !result && (
          <div className="state-card" role="status">
            <h2>Loading your orders…</h2>
            <p>Reading order records tied to your account.</p>
          </div>
        )}

        {!loading && result && result.items.length === 0 && (
          <div className="state-card">
            <h2>No orders yet</h2>
            <p>
              When you place an order, it will appear here with its items,
              quantities, total and current status.
            </p>
            <div className="state-card__actions">
              <Link className="button button--primary" to="/marketplace">
                Start shopping
              </Link>
            </div>
          </div>
        )}

        {result && result.items.length > 0 && (
          <>
            <div className="order-list">
              {result.items.map((order) => (
                <Link
                  className="order-card"
                  to={`/orders/${order.id}`}
                  key={order.id}
                >
                  <div className="order-card__head">
                    <div>
                      <span className="order-card__number">
                        {order.orderNumber}
                      </span>
                      <p>
                        {order.store.name} · {formatDate(order.placedAt)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>

                  <div className="order-card__body">
                    <p>{itemsSummary(order)}</p>
                    <strong>{formatPaise(order.totalPaise)}</strong>
                  </div>

                  <div className="order-card__foot">
                    <span>
                      {order.deliveryFeeStatus === 'calculated'
                        ? `Delivery ${formatPaise(order.deliveryFeePaise)}${
                            order.deliveryRoute
                              ? ` · ${formatDistance(order.deliveryRoute.distanceMeters)}`
                              : ''
                          }`
                        : 'Delivery fee: pending Maps setup'}
                    </span>
                    <span>View details →</span>
                  </div>
                </Link>
              ))}
            </div>

            {result.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="button button--outline button--small"
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1 || loading}
                >
                  Previous
                </button>
                <span>
                  Page {result.page} of {result.totalPages}
                </span>
                <button
                  className="button button--outline button--small"
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(result.totalPages, current + 1),
                    )
                  }
                  disabled={page >= result.totalPages || loading}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
