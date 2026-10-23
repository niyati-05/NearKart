import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  getSellerOrders,
  updateSellerOrderStatus,
  ORDER_STATUS_LABELS,
  type OrderListResponse,
  type OrderStatus,
  type SellerOrder,
  type SellerOrderStatus,
} from '../../api/orders';
import { OrderStatusBadge } from '../orders/OrderStatusBadge';
import { formatDateTime } from '../../lib/date';
import { formatDistance, formatDuration } from '../../lib/delivery';
import { formatPaise } from '../../lib/money';

const PAGE_SIZE = 20;

interface StatusAction {
  status: SellerOrderStatus;
  label: string;
  danger?: boolean;
}

const statusActions: Record<OrderStatus, StatusAction[]> = {
  pending: [
    { status: 'confirmed', label: 'Confirm order' },
    { status: 'cancelled', label: 'Cancel order', danger: true },
  ],
  confirmed: [
    { status: 'preparing', label: 'Start preparing' },
    { status: 'cancelled', label: 'Cancel order', danger: true },
  ],
  preparing: [
    { status: 'ready_for_pickup', label: 'Mark ready for pickup' },
    { status: 'cancelled', label: 'Cancel order', danger: true },
  ],
  ready_for_pickup: [
    { status: 'delivered', label: 'Mark delivered' },
  ],
  delivered: [],
  cancelled: [],
};

const filterOptions: Array<{ value: '' | OrderStatus; label: string }> = [
  { value: '', label: 'All orders' },
  { value: 'pending', label: ORDER_STATUS_LABELS.pending },
  { value: 'confirmed', label: ORDER_STATUS_LABELS.confirmed },
  { value: 'preparing', label: ORDER_STATUS_LABELS.preparing },
  { value: 'ready_for_pickup', label: ORDER_STATUS_LABELS.ready_for_pickup },
  { value: 'delivered', label: ORDER_STATUS_LABELS.delivered },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled },
];

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not reach the API. Check that the backend is running.';
}

export function SellerOrdersPage() {
  const [result, setResult] =
    useState<OrderListResponse<SellerOrder> | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | OrderStatus>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    getSellerOrders(page, PAGE_SIZE, statusFilter || undefined)
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
  }, [page, statusFilter, reloadToken]);

  async function handleStatusChange(
    order: SellerOrder,
    nextStatus: SellerOrderStatus,
  ) {
    if (
      nextStatus === 'cancelled' &&
      !window.confirm(
        `Cancel ${order.orderNumber}? Any reserved stock will be restored.`,
      )
    ) {
      return;
    }

    setUpdatingId(order.id);
    setActionError(null);
    setNotice(null);

    try {
      const response = await updateSellerOrderStatus(order.id, nextStatus);
      setNotice(
        `${response.order.orderNumber} is now ${ORDER_STATUS_LABELS[
          response.order.status
        ].toLowerCase()}.`,
      );
      setReloadToken((token) => token + 1);
    } catch (caught) {
      setActionError(describeError(caught));
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="seller-page">
      <div className="container seller-page__inner">
        <header className="seller-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Seller orders</p>
            <h1>Incoming orders</h1>
            <p>
              Only orders placed with your store are shown. Confirming and
              cancelling are enforced by the API against your store ownership
              and the current order status.
            </p>
          </div>
          <div className="seller-page__head-actions">
            <Link className="button button--outline" to="/seller">
              Store dashboard
            </Link>
            <Link className="button button--outline" to="/marketplace">
              View marketplace
            </Link>
          </div>
        </header>

        {notice && (
          <div className="seller-alert seller-alert--success" role="status">
            <strong>{notice}</strong>
          </div>
        )}

        {actionError && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Order update failed</strong>
            <p>{actionError}</p>
          </div>
        )}

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

        <div className="seller-order-toolbar">
          <label className="form-field seller-order-filter">
            <span>Filter by status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as '' | OrderStatus);
                setPage(1);
              }}
            >
              {filterOptions.map((option) => (
                <option key={option.value || 'all'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {result && (
            <p className="seller-order-toolbar__count" role="status">
              {result.total} {result.total === 1 ? 'order' : 'orders'}
            </p>
          )}
        </div>

        {loading && !result && (
          <div className="state-card" role="status">
            <h2>Loading orders…</h2>
            <p>Reading orders for your store from MongoDB.</p>
          </div>
        )}

        {!loading && result && result.items.length === 0 && (
          <div className="state-card">
            <h2>No orders in this view</h2>
            <p>
              When a customer places an order with your store, it will appear
              here with the items, contact details and delivery action buttons.
            </p>
            <div className="state-card__actions">
              <Link className="button button--primary" to="/marketplace">
                View marketplace
              </Link>
            </div>
          </div>
        )}

        {result && result.items.length > 0 && (
          <>
            <div className="seller-order-list">
              {result.items.map((order) => {
                const actions = statusActions[order.status];
                const updating = updatingId === order.id;

                return (
                  <article className="seller-order" key={order.id}>
                    <header className="seller-order__head">
                      <div>
                        <span className="order-card__number">
                          {order.orderNumber}
                        </span>
                        <p>{formatDateTime(order.placedAt)}</p>
                      </div>
                      <OrderStatusBadge status={order.status} />
                    </header>

                    <div className="seller-order__columns">
                      <section>
                        <h3>Customer</h3>
                        <p className="seller-order__customer-name">
                          {order.customer.fullName}
                        </p>
                        <p>{order.customer.phone}</p>
                        <p>
                          {order.customer.city}, {order.customer.state}{' '}
                          {order.customer.postalCode}
                        </p>
                        <p>{order.customer.country}</p>
                        <p className="seller-order__privacy">
                          Street lines are withheld from sellers by the
                          platform privacy policy. Contact the customer to
                          arrange handover.
                        </p>
                      </section>

                      <section>
                        <h3>Items</h3>
                        <ul className="seller-order__items">
                          {order.items.map((item) => (
                            <li key={item.productId}>
                              <span>
                                {item.name}
                                <small>
                                  {item.quantity} × {formatPaise(item.pricePaise)}
                                </small>
                              </span>
                              <strong>{formatPaise(item.lineTotalPaise)}</strong>
                            </li>
                          ))}
                        </ul>
                        <div className="seller-order__totals">
                          <span>
                            Subtotal {formatPaise(order.subtotalPaise)}
                          </span>
                          <span
                            className={
                              order.deliveryFeeStatus ===
                              'pending_maps_integration'
                                ? 'cart-summary__pending'
                                : undefined
                            }
                          >
                            {order.deliveryFeeStatus === 'calculated'
                              ? `Delivery ${formatPaise(order.deliveryFeePaise)}`
                              : 'Delivery pending Maps setup'}
                          </span>
                          <strong>Total {formatPaise(order.totalPaise)}</strong>
                        </div>

                        {order.deliveryRouteSummary && (
                          <p className="seller-order__route">
                            Road distance{' '}
                            {formatDistance(
                              order.deliveryRouteSummary.distanceMeters,
                            )}{' '}
                            · estimated drive{' '}
                            {formatDuration(
                              order.deliveryRouteSummary.durationSeconds,
                            )}
                          </p>
                        )}

                        {order.deliveryFeeStatus === 'pending_maps_integration' &&
                          order.deliveryQuoteMessage && (
                            <p className="seller-order__route">
                              {order.deliveryQuoteMessage}
                            </p>
                          )}
                      </section>
                    </div>

                    <div className="seller-order__history">
                      <details>
                        <summary>Status history</summary>
                        <ol className="status-timeline status-timeline--compact">
                          {order.statusHistory.map((entry, index) => (
                            <li
                              key={`${entry.status}-${entry.changedAt}-${index}`}
                            >
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
                      </details>
                    </div>

                    {order.status === 'cancelled' && (
                      <p
                        className={
                          order.stockRestored
                            ? 'seller-order__stock seller-order__stock--ok'
                            : 'seller-order__stock seller-order__stock--warn'
                        }
                      >
                        {order.stockRestored
                          ? 'Stock restored for this cancellation.'
                          : 'Stock restoration could not be confirmed. Check product stock manually.'}
                      </p>
                    )}

                    {actions.length > 0 && (
                      <div className="seller-order__actions">
                        {actions.map((action) => (
                          <button
                            className={`button button--small ${
                              action.danger
                                ? 'button--danger'
                                : 'button--primary'
                            }`}
                            key={action.status}
                            type="button"
                            onClick={() =>
                              void handleStatusChange(order, action.status)
                            }
                            disabled={updating || updatingId !== null}
                          >
                            {updating ? 'Updating…' : action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                );
              })}
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
