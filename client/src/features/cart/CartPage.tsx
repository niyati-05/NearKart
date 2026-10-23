import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import type { CartItem } from '../../api/cart';
import { ProductImage } from '../../components/ProductImage';
import { formatPaise } from '../../lib/money';
import { useCart } from './CartProvider';

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not update your cart. Please try again.';
}

export function CartPage() {
  const { cart, loading, error, updateItem, removeItem, clear, refresh } =
    useCart();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(
    productId: string,
    action: () => Promise<unknown>,
  ) {
    setPendingId(productId);
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(describeError(caught));
    } finally {
      setPendingId(null);
    }
  }

  function handleQuantity(item: CartItem, quantity: number) {
    if (quantity < 1 || quantity > item.stock) {
      return;
    }
    void runAction(item.productId, () => updateItem(item.productId, quantity));
  }

  async function handleClear() {
    if (!window.confirm('Remove every item from your cart?')) {
      return;
    }

    setPendingId('all');
    setActionError(null);
    try {
      await clear();
    } catch (caught) {
      setActionError(describeError(caught));
    } finally {
      setPendingId(null);
    }
  }

  if (loading && !cart) {
    return (
      <div className="commerce-page">
        <div className="container commerce-page__inner">
          <div className="state-card" role="status">
            <h1>Loading your cart…</h1>
            <p>Reading your saved cart from the server.</p>
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
            <h1>Could not load your cart</h1>
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
            <p className="eyebrow eyebrow--dark">Your cart</p>
            <h1>Your cart is empty</h1>
            <p>
              Browse the marketplace and add products from one store. Your cart
              is saved to your customer account and survives page navigation
              and sign-in.
            </p>
            <div className="state-card__actions">
              <Link className="button button--primary" to="/marketplace">
                Browse marketplace
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="commerce-page">
      <div className="container commerce-page__inner">
        <header className="commerce-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Shop cart</p>
            <h1>Your cart</h1>
            <p>
              {cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'} from{' '}
              <strong>{cart.store?.name ?? 'this store'}</strong>. Quantities
              are checked against current stock again when you place the order.
            </p>
          </div>
          <div className="commerce-page__head-actions">
            <Link className="button button--outline" to="/marketplace">
              Keep shopping
            </Link>
            <button
              className="button button--outline"
              type="button"
              onClick={() => void handleClear()}
              disabled={pendingId !== null}
            >
              Clear cart
            </button>
          </div>
        </header>

        {cart.hasIssues && (
          <div className="seller-alert seller-alert--warning" role="alert">
            <strong>Some items need attention</strong>
            <p>
              Remove or reduce unavailable items before continuing to checkout.
              Your order cannot be placed until every item is available in the
              requested quantity.
            </p>
          </div>
        )}

        {actionError && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Cart update failed</strong>
            <p>{actionError}</p>
          </div>
        )}

        <div className="cart-layout">
          <section className="cart-items" aria-label="Cart items">
            {cart.items.map((item) => {
              const pending = pendingId === item.productId;
              return (
                <article
                  className={`cart-item ${item.isAvailable ? '' : 'cart-item--issue'}`}
                  key={item.productId}
                >
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.name}
                    className="cart-item__image"
                  />

                  <div className="cart-item__info">
                    <Link
                      className="cart-item__name"
                      to={`/marketplace/${item.productId}`}
                    >
                      {item.name}
                    </Link>
                    <p className="cart-item__price">
                      {formatPaise(item.pricePaise)} each
                    </p>
                    {item.issue && (
                      <p className="cart-item__issue" role="alert">
                        {item.issue}
                      </p>
                    )}
                    <p className="cart-item__stock">
                      {item.stock > 0
                        ? `${item.stock} available`
                        : 'Out of stock'}
                    </p>
                  </div>

                  <div className="cart-item__quantity">
                    <span className="cart-item__label">Quantity</span>
                    <div className="quantity-stepper">
                      <button
                        type="button"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() =>
                          handleQuantity(item, item.quantity - 1)
                        }
                        disabled={
                          pending || item.quantity <= 1 || !item.stock
                        }
                      >
                        −
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() =>
                          handleQuantity(item, item.quantity + 1)
                        }
                        disabled={
                          pending ||
                          item.quantity >= item.stock ||
                          item.quantity >= 99
                        }
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="cart-item__line">
                    <span className="cart-item__label">Subtotal</span>
                    <strong>{formatPaise(item.lineTotalPaise)}</strong>
                    <button
                      className="cart-item__remove"
                      type="button"
                      onClick={() =>
                        void runAction(item.productId, () =>
                          removeItem(item.productId),
                        )
                      }
                      disabled={pending || pendingId === 'all'}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="cart-summary" aria-labelledby="cart-summary-title">
            <h2 id="cart-summary-title">Order summary</h2>
            <dl>
              <div>
                <dt>Items ({cart.itemCount})</dt>
                <dd>{formatPaise(cart.subtotalPaise)}</dd>
              </div>
              <div>
                <dt>Delivery fee</dt>
                <dd className="cart-summary__pending">Pending Maps setup</dd>
              </div>
              <div className="cart-summary__total">
                <dt>Total (excluding delivery)</dt>
                <dd>{formatPaise(cart.subtotalPaise)}</dd>
              </div>
            </dl>
            <p className="cart-summary__note">
              This is not a delivery quote. Google Maps delivery-cost
              estimation is not implemented yet, so no delivery amount has been
              calculated or added.
            </p>

            {cart.hasIssues ? (
              <span
                className="button button--primary cart-summary__cta is-disabled"
                aria-disabled="true"
              >
                Fix cart to continue
              </span>
            ) : (
              <Link
                className="button button--primary cart-summary__cta"
                to="/checkout"
              >
                Continue to checkout
              </Link>
            )}

            <p className="cart-summary__secure">
              Your cart is saved to your account and only visible to you.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
