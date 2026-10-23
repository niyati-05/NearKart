import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { getProduct, type Product } from '../../api/products';
import { formatPaise } from '../../lib/money';
import { ProductImage } from '../../components/ProductImage';
import { AddToCartButton } from '../cart/AddToCartButton';

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!id) {
        setStatus('error');
        setError('This product link is missing an id.');
        setErrorStatus(400);
        return;
      }

      setStatus('loading');
      setError(null);
      setErrorStatus(null);

      try {
        const response = await getProduct(id);
        if (!cancelled) {
          setProduct(response.product);
          setStatus('ready');
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus('error');
          setError(
            caught instanceof ApiError
              ? caught.message
              : 'Could not load this product. Check that the API is running.',
          );
          setErrorStatus(caught instanceof ApiError ? caught.status : null);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (status === 'loading') {
    return (
      <div className="container product-detail-page">
        <p className="sr-only" role="status">
          Loading product…
        </p>
        <div className="product-detail product-detail--skeleton">
          <div className="skeleton skeleton--detail-image" />
          <div className="product-detail__info">
            <div className="skeleton skeleton--chip" />
            <div className="skeleton skeleton--heading" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
            <div className="skeleton skeleton--line" />
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !product) {
    const notFound = errorStatus === 404;
    const invalid = errorStatus === 400;

    return (
      <div className="container product-detail-page">
        <div className="state-card state-card--error" role="alert">
          <h1>
            {notFound
              ? 'Product not found'
              : invalid
                ? 'This product link is invalid'
                : 'Could not load this product'}
          </h1>
          <p>
            {notFound
              ? 'The product may have been removed, paused by its seller, or the link may be wrong.'
              : (error ?? 'Please try again.')}
          </p>
          <div className="state-card__actions">
            <Link className="button button--primary" to="/marketplace">
              Back to marketplace
            </Link>
            {!notFound && !invalid && (
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
    );
  }

  return (
    <div className="product-detail-page">
      <div className="container">
        <Link className="breadcrumb" to="/marketplace">
          <span aria-hidden="true">←</span> Back to marketplace
        </Link>

        <article className="product-detail">
          <ProductImage
            src={product.imageUrl}
            alt={product.name}
            className="product-detail__image"
            eager
          />

          <div className="product-detail__info">
            <span className="category-chip">{product.category}</span>
            <h1>{product.name}</h1>
            <p className="product-detail__store">
              Sold by <strong>{product.store.name}</strong>
              <span aria-hidden="true"> · </span>
              {product.store.city}
            </p>

            <p className="product-detail__price">
              {formatPaise(product.pricePaise)}
            </p>

            <div className="product-detail__badges">
              <span
                className={`availability ${
                  product.inStock ? 'availability--in' : 'availability--out'
                }`}
              >
                {product.inStock ? 'In stock' : 'Out of stock'}
              </span>
              <span className="product-detail__stock">
                {product.stock > 0
                  ? `${product.stock} available`
                  : 'Currently unavailable'}
              </span>
            </div>

            <section className="product-detail__description">
              <h2>About this product</h2>
              <p>{product.description}</p>
            </section>

            <dl className="product-detail__facts">
              <div>
                <dt>Category</dt>
                <dd>{product.category}</dd>
              </div>
              <div>
                <dt>Store</dt>
                <dd>
                  {product.store.name}, {product.store.city}
                </dd>
              </div>
              <div>
                <dt>Availability</dt>
                <dd>{product.inStock ? 'In stock' : 'Out of stock'}</dd>
              </div>
            </dl>

            <div className="product-detail__purchase">
              <AddToCartButton
                productId={product.id}
                inStock={product.inStock}
              />
              <p>
                Add this product to your cart, then choose quantities at
                checkout. Stock is checked again on the server when you place
                the order.
              </p>
            </div>

            <div className="product-detail__note">
              <strong>Delivery fee is pending.</strong>
              <p>
                Delivery estimation will use Google Maps in a later phase. For
                now the checkout total covers products only; no delivery quote
                has been calculated.
              </p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
