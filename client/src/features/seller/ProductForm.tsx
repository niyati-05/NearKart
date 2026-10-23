import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../api/client';
import {
  PRODUCT_CATEGORIES,
  createProduct,
  updateProduct,
  type Product,
  type ProductCategoryId,
  type ProductInput,
} from '../../api/products';
import type { StoreProfile } from '../../api/stores';
import { ProductImage } from '../../components/ProductImage';
import { paiseToRupeeInput, parseRupeeInput } from '../../lib/money';

interface ProductFormProps {
  store: StoreProfile | null;
  editing: Product | null;
  onSaved: (message: string) => void;
  onCancelEdit: () => void;
}

interface ProductFormState {
  name: string;
  description: string;
  categoryId: ProductCategoryId;
  price: string;
  stock: string;
  lowStockThreshold: string;
  imageUrl: string;
  isActive: boolean;
}

function emptyForm(): ProductFormState {
  return {
    name: '',
    description: '',
    categoryId: 'groceries',
    price: '',
    stock: '0',
    lowStockThreshold: '5',
    imageUrl: '',
    isActive: true,
  };
}

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function ProductForm({
  store,
  editing,
  onSaved,
  onCancelEdit,
}: ProductFormProps) {
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        description: editing.description,
        categoryId: editing.categoryId,
        price: paiseToRupeeInput(editing.pricePaise),
        stock: String(editing.stock),
        lowStockThreshold: String(editing.lowStockThreshold),
        imageUrl: editing.imageUrl,
        isActive: editing.isActive,
      });
    } else {
      setForm(emptyForm());
    }
    setError(null);
  }, [editing]);

  function updateField<K extends keyof ProductFormState>(
    key: K,
    value: ProductFormState[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const name = form.name.trim();
    const description = form.description.trim();
    const imageUrl = form.imageUrl.trim();

    if (name.length < 2) {
      setError('Product name must be at least 2 characters.');
      return;
    }
    if (name.length > 120) {
      setError('Product name must be 120 characters or fewer.');
      return;
    }
    if (description.length < 5) {
      setError('Add a description of at least 5 characters.');
      return;
    }
    if (description.length > 2000) {
      setError('Description must be 2000 characters or fewer.');
      return;
    }

    const price = parseRupeeInput(form.price, 100);
    if (price.error || price.paise === undefined) {
      setError(price.error ?? 'Enter a valid price.');
      return;
    }

    const stock = wholeNumber(form.stock);
    if (stock === null || stock < 0) {
      setError('Stock must be a whole number of 0 or more.');
      return;
    }
    if (stock > 1_000_000) {
      setError('Stock is too large.');
      return;
    }

    const threshold = wholeNumber(form.lowStockThreshold);
    if (threshold === null || threshold < 0) {
      setError('Low-stock threshold must be a whole number of 0 or more.');
      return;
    }
    if (threshold > 10_000) {
      setError('Low-stock threshold is too large.');
      return;
    }

    if (imageUrl.length > 500) {
      setError('Image URL must be 500 characters or fewer.');
      return;
    }

    try {
      const parsedUrl = new URL(imageUrl);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        setError('Image URL must start with http:// or https://.');
        return;
      }
    } catch {
      setError('Enter a valid image URL, starting with http:// or https://.');
      return;
    }

    const input: ProductInput = {
      name,
      description,
      categoryId: form.categoryId,
      pricePaise: price.paise,
      stock,
      imageUrl,
      lowStockThreshold: threshold,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateProduct(editing.id, input);
        onSaved('Product updated.');
      } else {
        await createProduct(input);
        setForm(emptyForm());
        onSaved('Product added to your store.');
      }
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.details?.[0]?.message ?? caught.message);
      } else {
        setError('Could not save the product. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!store) {
    return (
      <section className="seller-card seller-card--muted" id="product-form">
        <p className="eyebrow eyebrow--dark">Add a product</p>
        <h2>Create your store first</h2>
        <p className="seller-card__intro">
          Products must belong to a store. Save the store profile on this page,
          then the product form will unlock.
        </p>
      </section>
    );
  }

  return (
    <section className="seller-card" id="product-form" aria-labelledby="product-form-title">
      <div className="seller-card__head">
        <div>
          <p className="eyebrow eyebrow--dark">
            {editing ? 'Edit product' : 'Add a product'}
          </p>
          <h2 id="product-form-title">
            {editing ? editing.name : 'New listing'}
          </h2>
        </div>
        {editing && (
          <button
            className="button button--outline button--small"
            type="button"
            onClick={onCancelEdit}
          >
            Cancel edit
          </button>
        )}
      </div>

      <p className="seller-card__intro">
        Prices are entered in rupees and stored by the API as integer paise.
        Stock is checked again at checkout in a later phase.
      </p>

      <form className="seller-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="product-name">Product name</label>
          <input
            id="product-name"
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="e.g. Basmati Rice 5kg"
            maxLength={120}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="product-category">Category</label>
            <select
              id="product-category"
              value={form.categoryId}
              onChange={(event) =>
                updateField(
                  'categoryId',
                  event.target.value as ProductCategoryId,
                )
              }
            >
              {PRODUCT_CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="product-price">Price (₹)</label>
            <input
              id="product-price"
              inputMode="decimal"
              value={form.price}
              onChange={(event) => updateField('price', event.target.value)}
              placeholder="e.g. 499"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label htmlFor="product-stock">Stock quantity</label>
            <input
              id="product-stock"
              inputMode="numeric"
              value={form.stock}
              onChange={(event) => updateField('stock', event.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="product-threshold">Low-stock alert at</label>
            <input
              id="product-threshold"
              inputMode="numeric"
              value={form.lowStockThreshold}
              onChange={(event) =>
                updateField('lowStockThreshold', event.target.value)
              }
              required
            />
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="product-image">Image URL</label>
          <input
            id="product-image"
            type="url"
            value={form.imageUrl}
            onChange={(event) => updateField('imageUrl', event.target.value)}
            placeholder="https://example.com/product.jpg"
            maxLength={500}
            required
          />
          <span className="form-hint">
            Use a public https:// image URL. If it fails to load, the storefront
            shows a neutral placeholder.
          </span>
        </div>

        {form.imageUrl.trim() && (
          <div className="product-form__preview">
            <ProductImage
              src={form.imageUrl.trim()}
              alt="Product image preview"
              className="product-form__preview-image"
            />
            <span>Image preview</span>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="product-description">Description</label>
          <textarea
            id="product-description"
            value={form.description}
            onChange={(event) =>
              updateField('description', event.target.value)
            }
            placeholder="Describe the product, size and what makes it useful."
            rows={5}
            maxLength={2000}
            required
          />
          <span className="form-hint">
            {form.description.length}/2000 characters
          </span>
        </div>

        <label className="checkbox-field" htmlFor="product-active">
          <input
            id="product-active"
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => updateField('isActive', event.target.checked)}
          />
          <span>
            <strong>Show in marketplace</strong>
            <small>
              Uncheck to pause this listing. Out-of-stock products can stay
              visible with an availability notice.
            </small>
          </span>
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="seller-form__actions">
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Saving…'
              : editing
                ? 'Save changes'
                : 'Add product'}
          </button>
          {editing && (
            <button
              className="button button--outline"
              type="button"
              onClick={onCancelEdit}
              disabled={submitting}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
