import { Link } from 'react-router-dom';
import type { Product } from '../../api/products';
import { formatPaise } from '../../lib/money';
import { ProductImage } from '../../components/ProductImage';
import { AddToCartButton } from '../cart/AddToCartButton';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="product-card">
      <Link
        className="product-card__link"
        to={`/marketplace/${product.id}`}
        aria-label={`${product.name} from ${product.store.name}`}
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          className="product-card__image"
        />

        <div className="product-card__body">
          <span className="category-chip">{product.category}</span>
          <h3>{product.name}</h3>
          <p className="product-card__store">
            {product.store.name}
            <span aria-hidden="true"> · </span>
            {product.store.city}
          </p>

          <div className="product-card__footer">
            <strong className="product-card__price">
              {formatPaise(product.pricePaise)}
            </strong>
            <span
              className={`availability ${
                product.inStock ? 'availability--in' : 'availability--out'
              }`}
            >
              {product.inStock ? 'In stock' : 'Out of stock'}
            </span>
          </div>
        </div>
      </Link>

      <div className="product-card__actions">
        <AddToCartButton
          productId={product.id}
          inStock={product.inStock}
          size="small"
        />
      </div>
    </article>
  );
}
