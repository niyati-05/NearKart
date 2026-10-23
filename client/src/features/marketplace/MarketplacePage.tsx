import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import {
  PRODUCT_CATEGORIES,
  listProducts,
  type AvailabilityFilter,
  type ProductCategoryId,
  type ProductListResponse,
} from '../../api/products';
import { parseRupeeInput } from '../../lib/money';
import { ProductCard } from './ProductCard';

const PAGE_SIZE = 12;

interface Filters {
  q: string;
  category: '' | ProductCategoryId;
  availability: AvailabilityFilter;
  minPrice: string;
  maxPrice: string;
}

const emptyFilters: Filters = {
  q: '',
  category: '',
  availability: 'all',
  minPrice: '',
  maxPrice: '',
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not load products. Check that the API is running and try again.';
}

export function MarketplacePage() {
  const [draftFilters, setDraftFilters] = useState<Filters>({
    ...emptyFilters,
  });
  const [appliedFilters, setAppliedFilters] = useState<Filters>({
    ...emptyFilters,
  });
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [data, setData] = useState<ProductListResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus('loading');
      setError(null);

      const min = parseRupeeInput(appliedFilters.minPrice, 0);
      const max = parseRupeeInput(appliedFilters.maxPrice, 0);

      try {
        const response = await listProducts({
          q: appliedFilters.q.trim() || undefined,
          category: appliedFilters.category || undefined,
          availability: appliedFilters.availability,
          minPricePaise: min.paise,
          maxPricePaise: max.paise,
          page,
          limit: PAGE_SIZE,
        });

        if (!cancelled) {
          setData(response);
          setStatus('ready');
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus('error');
          setError(describeError(caught));
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [appliedFilters, page, reloadToken]);

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setDraftFilters((current) => ({ ...current, [key]: value }));
  }

  function handleApply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const min = parseRupeeInput(draftFilters.minPrice, 0);
    const max = parseRupeeInput(draftFilters.maxPrice, 0);

    if (min.error) {
      setFormError(`Minimum price: ${min.error}`);
      return;
    }
    if (max.error) {
      setFormError(`Maximum price: ${max.error}`);
      return;
    }
    if (
      min.paise !== undefined &&
      max.paise !== undefined &&
      min.paise > max.paise
    ) {
      setFormError('Minimum price cannot be greater than maximum price.');
      return;
    }

    setAppliedFilters({ ...draftFilters, q: draftFilters.q.trim() });
    setPage(1);
  }

  function handleReset() {
    setDraftFilters({ ...emptyFilters });
    setAppliedFilters({ ...emptyFilters });
    setPage(1);
    setFormError(null);
  }

  const hasActiveFilters =
    appliedFilters.q.trim() !== '' ||
    appliedFilters.category !== '' ||
    appliedFilters.availability !== 'all' ||
    appliedFilters.minPrice !== '' ||
    appliedFilters.maxPrice !== '';

  return (
    <div className="marketplace-page">
      <section className="marketplace-hero">
        <div className="container marketplace-hero__inner">
          <div>
            <p className="eyebrow eyebrow--light">NearKart marketplace</p>
            <h1>Real products from local seller stores</h1>
            <p className="marketplace-hero__lead">
              Browse live listings saved in MongoDB. Search by name, narrow by
              category, price or availability, and open a product to see the
              full details.
            </p>
          </div>

          <div className="marketplace-hero__note">
            <span className="marketplace-hero__note-label">Phase 4</span>
            <p>
              Browsing only for now. Cart, checkout and delivery are deliberately
              not part of this phase.
            </p>
          </div>
        </div>
      </section>

      <div className="container marketplace-body">
        <form
          className="filter-panel"
          onSubmit={handleApply}
          aria-label="Filter products"
        >
          <div className="filter-panel__grid">
            <div className="form-field filter-panel__search">
              <label htmlFor="marketplace-search">Search by product name</label>
              <input
                id="marketplace-search"
                type="search"
                value={draftFilters.q}
                onChange={(event) => updateFilter('q', event.target.value)}
                placeholder="Rice, earbuds, notebook…"
                maxLength={100}
              />
            </div>

            <div className="form-field">
              <label htmlFor="marketplace-category">Category</label>
              <select
                id="marketplace-category"
                value={draftFilters.category}
                onChange={(event) =>
                  updateFilter(
                    'category',
                    event.target.value as Filters['category'],
                  )
                }
              >
                <option value="">All categories</option>
                {PRODUCT_CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="marketplace-availability">Availability</label>
              <select
                id="marketplace-availability"
                value={draftFilters.availability}
                onChange={(event) =>
                  updateFilter(
                    'availability',
                    event.target.value as AvailabilityFilter,
                  )
                }
              >
                <option value="all">All products</option>
                <option value="in_stock">In stock</option>
                <option value="out_of_stock">Out of stock</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="marketplace-min-price">Min price (₹)</label>
              <input
                id="marketplace-min-price"
                inputMode="decimal"
                value={draftFilters.minPrice}
                onChange={(event) =>
                  updateFilter('minPrice', event.target.value)
                }
                placeholder="0"
              />
            </div>

            <div className="form-field">
              <label htmlFor="marketplace-max-price">Max price (₹)</label>
              <input
                id="marketplace-max-price"
                inputMode="decimal"
                value={draftFilters.maxPrice}
                onChange={(event) =>
                  updateFilter('maxPrice', event.target.value)
                }
                placeholder="Any"
              />
            </div>
          </div>

          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="filter-panel__actions">
            <button className="button button--primary" type="submit">
              Apply filters
            </button>
            <button
              className="button button--outline"
              type="button"
              onClick={handleReset}
            >
              Reset
            </button>
          </div>
        </form>

        <div className="marketplace-results">
          <div className="marketplace-results__head">
            <div>
              <p className="eyebrow eyebrow--dark">Catalogue</p>
              <h2>
                {data
                  ? `${data.total} ${data.total === 1 ? 'product' : 'products'}`
                  : 'Products'}
              </h2>
            </div>
            {status === 'ready' && data && data.totalPages > 1 && (
              <p className="marketplace-results__page">
                Page {data.page} of {data.totalPages}
              </p>
            )}
          </div>

          {status === 'loading' && (
            <>
              <p className="sr-only" role="status">
                Loading products…
              </p>
              <ProductGridSkeleton />
            </>
          )}

          {status === 'error' && (
            <div className="state-card state-card--error" role="alert">
              <h3>Could not load the marketplace</h3>
              <p>{error}</p>
              <button
                className="button button--outline"
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
              >
                Try again
              </button>
            </div>
          )}

          {status === 'ready' && data && data.items.length === 0 && (
            <div className="state-card">
              <h3>
                {hasActiveFilters
                  ? 'No products match these filters'
                  : 'No products are listed yet'}
              </h3>
              <p>
                {hasActiveFilters
                  ? 'Try a different search term, category or price range. New products appear here as soon as sellers add them.'
                  : 'When a seller opens a store and adds a product, it will appear here. Sellers can manage listings from the seller dashboard.'}
              </p>
              {hasActiveFilters && (
                <button
                  className="button button--outline"
                  type="button"
                  onClick={handleReset}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {status === 'ready' && data && data.items.length > 0 && (
            <>
              <div className="product-grid">
                {data.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {data.totalPages > 1 && (
                <nav className="pagination" aria-label="Product pages">
                  <button
                    className="button button--outline button--small"
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={data.page <= 1}
                  >
                    Previous
                  </button>
                  <span>
                    Page {data.page} of {data.totalPages}
                  </span>
                  <button
                    className="button button--outline button--small"
                    type="button"
                    onClick={() => setPage((current) => current + 1)}
                    disabled={data.page >= data.totalPages}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <div className="product-card product-card--skeleton" key={index}>
          <div className="skeleton skeleton--image" />
          <div className="product-card__body">
            <div className="skeleton skeleton--chip" />
            <div className="skeleton skeleton--line" />
            <div className="skeleton skeleton--line skeleton--short" />
            <div className="skeleton skeleton--line skeleton--short" />
          </div>
        </div>
      ))}
    </div>
  );
}
