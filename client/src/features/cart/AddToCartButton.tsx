import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/AuthProvider';
import { useCart } from './CartProvider';

interface AddToCartButtonProps {
  productId: string;
  inStock: boolean;
  size?: 'small' | 'default';
}

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not add this product to your cart. Please try again.';
}

export function AddToCartButton({
  productId,
  inStock,
  size = 'default',
}: AddToCartButtonProps) {
  const { user, loading: authLoading } = useAuth();
  const { addItem } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!added) {
      return;
    }
    const timer = window.setTimeout(() => setAdded(false), 2200);
    return () => window.clearTimeout(timer);
  }, [added]);

  const customerOnly = user !== null && user.role !== 'customer';
  const disabled = !inStock || pending || authLoading || customerOnly;

  async function handleClick() {
    setError(null);

    if (!user) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }

    if (user.role !== 'customer') {
      setError('Only customer accounts can use the cart.');
      return;
    }

    setPending(true);
    try {
      await addItem(productId, 1);
      setAdded(true);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setPending(false);
    }
  }

  const label = !inStock
    ? 'Out of stock'
    : pending
      ? 'Adding…'
      : added
        ? 'Added to cart'
        : customerOnly
          ? 'Customer account required'
          : !user
            ? 'Sign in to add'
            : 'Add to cart';

  return (
    <div className="add-to-cart">
      <button
        className={`button button--primary add-to-cart__button ${
          size === 'small' ? 'button--small' : ''
        }`}
        type="button"
        onClick={() => void handleClick()}
        disabled={disabled}
        title={customerOnly ? 'Sign in with a customer account' : undefined}
      >
        {label}
      </button>
      {error && (
        <p className="add-to-cart__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
