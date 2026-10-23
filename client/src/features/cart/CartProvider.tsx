import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { ApiError } from '../../api/client';
import {
  addCartItem as addCartItemRequest,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem as removeCartItemRequest,
  updateCartItem as updateCartItemRequest,
  type Cart,
} from '../../api/cart';

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  itemCount: number;
  refresh: () => Promise<void>;
  addItem: (productId: string, quantity?: number) => Promise<Cart>;
  updateItem: (productId: string, quantity: number) => Promise<Cart>;
  removeItem: (productId: string) => Promise<Cart>;
  clear: () => Promise<Cart>;
}

const CartContext = createContext<CartContextValue | null>(null);

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Could not reach the cart. Check that the API is running.';
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      setLoading(true);
      return () => {
        cancelled = true;
      };
    }

    if (!user || user.role !== 'customer') {
      setCart(null);
      setError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setError(null);

    getCart()
      .then((response) => {
        if (!cancelled) {
          setCart(response.cart);
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
  }, [authLoading, user?.id, user?.role]);

  const refresh = useCallback(async () => {
    if (!user || user.role !== 'customer') {
      setCart(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await getCart();
      setCart(response.cart);
    } catch (caught) {
      setError(describeError(caught));
      throw caught;
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  const addItem = useCallback(
    async (productId: string, quantity = 1) => {
      const response = await addCartItemRequest(productId, quantity);
      setCart(response.cart);
      return response.cart;
    },
    [],
  );

  const updateItem = useCallback(
    async (productId: string, quantity: number) => {
      const response = await updateCartItemRequest(productId, quantity);
      setCart(response.cart);
      return response.cart;
    },
    [],
  );

  const removeItem = useCallback(async (productId: string) => {
    const response = await removeCartItemRequest(productId);
    setCart(response.cart);
    return response.cart;
  }, []);

  const clear = useCallback(async () => {
    const response = await clearCartRequest();
    setCart(response.cart);
    return response.cart;
  }, []);

  const value = useMemo(
    () => ({
      cart,
      loading,
      error,
      itemCount: cart?.itemCount ?? 0,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clear,
    }),
    [
      cart,
      loading,
      error,
      refresh,
      addItem,
      updateItem,
      removeItem,
      clear,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used inside <CartProvider>');
  }
  return context;
}
