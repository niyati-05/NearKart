import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  deleteProduct,
  getSellerProducts,
  type Product,
  type SellerProductSummary,
} from '../../api/products';
import { getMyStore, type StoreProfile } from '../../api/stores';
import { ProductImage } from '../../components/ProductImage';
import { formatPaise } from '../../lib/money';
import { ProductForm } from './ProductForm';
import { StoreProfileForm } from './StoreProfileForm';

const emptySummary: SellerProductSummary = {
  total: 0,
  lowStock: 0,
  outOfStock: 0,
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not reach the API. Check that the backend is running.';
}

function formatUpdated(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function productStatus(product: Product): { label: string; className: string } {
  if (!product.isActive) {
    return { label: 'Paused', className: 'availability--paused' };
  }
  if (product.stock === 0) {
    return { label: 'Out of stock', className: 'availability--out' };
  }
  if (product.stock <= product.lowStockThreshold) {
    return { label: 'Low stock', className: 'availability--low' };
  }
  return { label: 'In stock', className: 'availability--in' };
}

export function SellerDashboardPage() {
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<SellerProductSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const productFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);

      try {
        const storeResponse = await getMyStore();
        let nextProducts: Product[] = [];
        let nextSummary = emptySummary;

        if (storeResponse.store) {
          const productsResponse = await getSellerProducts();
          nextProducts = productsResponse.items;
          nextSummary = productsResponse.summary;
        }

        if (!cancelled) {
          setStore(storeResponse.store);
          setProducts(nextProducts);
          setSummary(nextSummary);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(describeError(caught));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const lowStockProducts = products.filter(
    (product) => product.stock <= product.lowStockThreshold,
  );

  function handleStoreSaved(nextStore: StoreProfile, message: string) {
    setStore(nextStore);
    setNotice(message);
    setActionError(null);
    setReloadToken((token) => token + 1);
  }

  function handleProductSaved(message: string) {
    setEditing(null);
    setNotice(message);
    setActionError(null);
    setReloadToken((token) => token + 1);
  }

  function startEditing(product: Product) {
    setEditing(product);
    setNotice(null);
    setActionError(null);
    window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  function startAdding() {
    setEditing(null);
    setNotice(null);
    setActionError(null);
    window.requestAnimationFrame(() => {
      productFormRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  async function handleDelete(product: Product) {
    if (
      !window.confirm(
        `Delete “${product.name}”? This removes the listing permanently.`,
      )
    ) {
      return;
    }

    setDeletingId(product.id);
    setActionError(null);
    setNotice(null);

    try {
      await deleteProduct(product.id);
      if (editing?.id === product.id) {
        setEditing(null);
      }
      setNotice('Product deleted.');
      setReloadToken((token) => token + 1);
    } catch (caught) {
      setActionError(describeError(caught));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading && !store && products.length === 0) {
    return (
      <div className="seller-page">
        <div className="container seller-page__inner">
          <div className="state-card" role="status">
            <h1>Loading your dashboard…</h1>
            <p>Reading your store and products from MongoDB.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loadError && !store) {
    return (
      <div className="seller-page">
        <div className="container seller-page__inner">
          <div className="state-card state-card--error" role="alert">
            <h1>Could not load your dashboard</h1>
            <p>{loadError}</p>
            <button
              className="button button--outline"
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="seller-page">
      <div className="container seller-page__inner">
        <header className="seller-page__head">
          <div>
            <p className="eyebrow eyebrow--dark">Seller workspace</p>
            <h1>{store ? store.name : 'Open your store'}</h1>
            <p>
              Manage your store profile, listings and stock. Every request is
              authorized again by the API and checked against your ownership.
            </p>
          </div>
          <div className="seller-page__head-actions">
            <Link className="button button--primary" to="/seller/orders">
              Manage orders
            </Link>
            <Link className="button button--outline" to="/marketplace">
              View marketplace
            </Link>
            <Link className="button button--outline" to="/account">
              Account
            </Link>
          </div>
        </header>

        {loading && (
          <p className="seller-refreshing" role="status">
            Refreshing dashboard…
          </p>
        )}

        {notice && (
          <div className="seller-alert seller-alert--success" role="status">
            <strong>{notice}</strong>
          </div>
        )}

        {actionError && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Action failed</strong>
            <p>{actionError}</p>
          </div>
        )}

        {loadError && store && (
          <div className="seller-alert seller-alert--error" role="alert">
            <strong>Could not refresh</strong>
            <p>{loadError} Showing the last loaded data.</p>
            <button
              className="button button--outline button--small"
              type="button"
              onClick={() => setReloadToken((token) => token + 1)}
            >
              Retry
            </button>
          </div>
        )}

        <div className="seller-stats">
          <div className="seller-stat">
            <span>Products</span>
            <strong>{summary.total}</strong>
            <small>total listings</small>
          </div>
          <div
            className={`seller-stat ${summary.lowStock > 0 ? 'seller-stat--warn' : ''}`}
          >
            <span>Low stock</span>
            <strong>{summary.lowStock}</strong>
            <small>at or below alert level</small>
          </div>
          <div
            className={`seller-stat ${summary.outOfStock > 0 ? 'seller-stat--danger' : ''}`}
          >
            <span>Out of stock</span>
            <strong>{summary.outOfStock}</strong>
            <small>cannot be bought</small>
          </div>
        </div>

        {summary.lowStock > 0 && (
          <div className="seller-alert seller-alert--warning" role="status">
            <strong>Low-stock warning</strong>
            <p>
              {summary.lowStock}{' '}
              {summary.lowStock === 1 ? 'product is' : 'products are'} at or
              below the alert level. Update stock or pause the listing.
            </p>
            <ul>
              {lowStockProducts.map((product) => (
                <li key={product.id}>
                  <span>{product.name}</span>
                  <span>
                    {product.stock === 0
                      ? 'Out of stock'
                      : `${product.stock} left (alert at ${product.lowStockThreshold})`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="seller-forms">
          <StoreProfileForm store={store} onSaved={handleStoreSaved} />
          <div ref={productFormRef}>
            <ProductForm
              store={store}
              editing={editing}
              onSaved={handleProductSaved}
              onCancelEdit={() => setEditing(null)}
            />
          </div>
        </div>

        <section
          className="seller-products"
          aria-labelledby="seller-products-title"
        >
          <div className="seller-products__head">
            <div>
              <p className="eyebrow eyebrow--dark">Inventory</p>
              <h2 id="seller-products-title">Your products</h2>
              <p>
                {summary.total}{' '}
                {summary.total === 1 ? 'listing' : 'listings'} in your store.
              </p>
            </div>
            {store && (
              <button
                className="button button--primary"
                type="button"
                onClick={startAdding}
              >
                Add product
              </button>
            )}
          </div>

          {products.length === 0 ? (
            <div className="state-card">
              <h3>{store ? 'No products yet' : 'Create your store first'}</h3>
              <p>
                {store
                  ? 'Use the form above to add your first listing. It will appear in the public marketplace immediately.'
                  : 'Add your store name, city and description above. The product form unlocks once the store exists.'}
              </p>
            </div>
          ) : (
            <div className="seller-product-list">
              {products.map((product) => {
                const status = productStatus(product);
                return (
                  <article
                    className={`seller-product ${
                      product.isActive ? '' : 'seller-product--paused'
                    }`}
                    key={product.id}
                  >
                    <ProductImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="seller-product__image"
                    />

                    <div className="seller-product__info">
                      <div className="seller-product__title">
                        <h3>{product.name}</h3>
                        <span className="category-chip">
                          {product.category}
                        </span>
                      </div>
                      <p className="seller-product__price">
                        {formatPaise(product.pricePaise)}
                      </p>
                      <p className="seller-product__meta">
                        {product.stock} in stock · alert at{' '}
                        {product.lowStockThreshold} · updated{' '}
                        {formatUpdated(product.updatedAt)}
                      </p>
                    </div>

                    <span className={`availability ${status.className}`}>
                      {status.label}
                    </span>

                    <div className="seller-product__actions">
                      <button
                        className="button button--outline button--small"
                        type="button"
                        onClick={() => startEditing(product)}
                      >
                        Edit
                      </button>
                      <button
                        className="button button--danger button--small"
                        type="button"
                        onClick={() => void handleDelete(product)}
                        disabled={deletingId === product.id}
                      >
                        {deletingId === product.id ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
