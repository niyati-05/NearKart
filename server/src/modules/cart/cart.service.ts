import type { ObjectId } from 'mongodb';
import { getDb } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';
import { isDuplicateKeyError } from '../../lib/mongo-errors.js';
import type { Product } from '../product/product.types.js';
import type { Store } from '../store/store.types.js';
import { toStoreSummary } from '../store/store.types.js';
import type { Cart, PublicCart } from './cart.types.js';
import { emptyPublicCart } from './cart.types.js';

function cartsCollection() {
  return getDb().collection<Cart>('carts');
}

function productsCollection() {
  return getDb().collection<Product>('products');
}

function storesCollection() {
  return getDb().collection<Store>('stores');
}

export async function findCart(userId: ObjectId): Promise<Cart | null> {
  return cartsCollection().findOne({ userId });
}

export async function clearCart(userId: ObjectId): Promise<void> {
  await cartsCollection().deleteOne({ userId });
}

/**
 * A customer may have one cart at a time. A cart belongs to a single store for
 * the first checkout MVP, but the record shape leaves room for splitting into
 * multiple store carts later.
 */
export async function addCartItem(
  userId: ObjectId,
  productId: ObjectId,
  quantity: number,
): Promise<PublicCart> {
  const product = await productsCollection().findOne({ _id: productId });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const store = await storesCollection().findOne({ _id: product.storeId });

  if (!store || store.status !== 'active' || !product.isActive) {
    throw new AppError(
      409,
      'PRODUCT_UNAVAILABLE',
      'This product is not available right now.',
    );
  }

  if (product.stock < quantity) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      product.stock === 0
        ? `${product.name} is out of stock.`
        : `Only ${product.stock} of ${product.name} left in stock.`,
    );
  }

  let cart = await findCart(userId);

  if (!cart) {
    const now = new Date();
    const newCart: Cart = {
      userId,
      storeId: product.storeId,
      items: [{ productId, quantity, addedAt: now }],
      createdAt: now,
      updatedAt: now,
    };

    try {
      const result = await cartsCollection().insertOne(newCart);
      return serializeCart({ ...newCart, _id: result.insertedId });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      // A concurrent add created the cart first. Continue with that cart.
      cart = await findCart(userId);
      if (!cart) {
        throw error;
      }
    }
  }

  if (cart.storeId.toHexString() !== product.storeId.toHexString()) {
    const existingStore = await storesCollection().findOne({
      _id: cart.storeId,
    });
    throw new AppError(
      409,
      'CART_STORE_CONFLICT',
      `Your cart already has items from ${existingStore?.name ?? 'another store'}. ` +
        `Clear the cart before adding products from ${store.name}.`,
    );
  }

  const existingItem = cart.items.find(
    (item) => item.productId.toHexString() === productId.toHexString(),
  );
  const nextQuantity = (existingItem?.quantity ?? 0) + quantity;

  if (nextQuantity > product.stock) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Only ${product.stock} of ${product.name} left in stock.`,
    );
  }

  const now = new Date();
  const nextItems = existingItem
    ? cart.items.map((item) =>
        item.productId.toHexString() === productId.toHexString()
          ? { ...item, quantity: nextQuantity }
          : item,
      )
    : [...cart.items, { productId, quantity, addedAt: now }];

  const updated = await cartsCollection().findOneAndUpdate(
    { _id: cart._id, userId },
    { $set: { items: nextItems, updatedAt: now } },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new AppError(
      409,
      'CART_CHANGED',
      'Your cart changed while it was being updated. Please try again.',
    );
  }

  return serializeCart(updated);
}

export async function updateCartItem(
  userId: ObjectId,
  productId: ObjectId,
  quantity: number,
): Promise<PublicCart> {
  const cart = await findCart(userId);

  if (!cart) {
    throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'This item is not in your cart.');
  }

  const item = cart.items.find(
    (entry) => entry.productId.toHexString() === productId.toHexString(),
  );

  if (!item) {
    throw new AppError(404, 'CART_ITEM_NOT_FOUND', 'This item is not in your cart.');
  }

  const product = await productsCollection().findOne({ _id: productId });

  if (!product) {
    throw new AppError(404, 'PRODUCT_NOT_FOUND', 'Product not found.');
  }

  const store = await storesCollection().findOne({ _id: product.storeId });

  if (!store || store.status !== 'active' || !product.isActive) {
    throw new AppError(
      409,
      'PRODUCT_UNAVAILABLE',
      'This product is not available right now.',
    );
  }

  if (quantity > product.stock) {
    throw new AppError(
      409,
      'INSUFFICIENT_STOCK',
      `Only ${product.stock} of ${product.name} left in stock.`,
    );
  }

  const now = new Date();
  const updated = await cartsCollection().findOneAndUpdate(
    { _id: cart._id, userId, 'items.productId': productId },
    {
      $set: {
        'items.$.quantity': quantity,
        updatedAt: now,
      },
    },
    { returnDocument: 'after' },
  );

  if (!updated) {
    throw new AppError(
      404,
      'CART_ITEM_NOT_FOUND',
      'This item is no longer in your cart.',
    );
  }

  return serializeCart(updated);
}

export async function removeCartItem(
  userId: ObjectId,
  productId: ObjectId,
): Promise<PublicCart> {
  const cart = await findCart(userId);

  if (!cart) {
    return emptyPublicCart();
  }

  const nextItems = cart.items.filter(
    (item) => item.productId.toHexString() !== productId.toHexString(),
  );

  if (nextItems.length === 0) {
    await clearCart(userId);
    return emptyPublicCart();
  }

  const updated = await cartsCollection().findOneAndUpdate(
    { _id: cart._id, userId },
    { $set: { items: nextItems, updatedAt: new Date() } },
    { returnDocument: 'after' },
  );

  return updated ? serializeCart(updated) : emptyPublicCart();
}

/** Read the customer's current cart and expose only catalogue data. */
export async function getCart(userId: ObjectId): Promise<PublicCart> {
  return serializeCart(await findCart(userId));
}

export async function serializeCart(cart: Cart | null): Promise<PublicCart> {
  if (!cart || cart.items.length === 0) {
    return emptyPublicCart();
  }

  const productIds = cart.items.map((item) => item.productId);
  const [store, products] = await Promise.all([
    storesCollection().findOne({ _id: cart.storeId }),
    productsCollection().find({ _id: { $in: productIds } }).toArray(),
  ]);

  const productMap = new Map(
    products.map((product) => [product._id!.toHexString(), product]),
  );
  const storeActive = store?.status === 'active';

  const items = cart.items.map((item) => {
    const product = productMap.get(item.productId.toHexString());
    const pricePaise = product?.pricePaise ?? 0;
    const lineTotalPaise = pricePaise * item.quantity;

    if (!product) {
      return {
        productId: item.productId.toHexString(),
        quantity: item.quantity,
        name: 'Product unavailable',
        imageUrl: '',
        pricePaise,
        lineTotalPaise,
        stock: 0,
        isAvailable: false,
        issue: 'This product is no longer available.',
      };
    }

    let issue: string | null = null;
    if (!storeActive) {
      issue = 'This store is not accepting orders right now.';
    } else if (!product.isActive) {
      issue = 'This product is paused by the seller.';
    } else if (product.storeId.toHexString() !== cart.storeId.toHexString()) {
      issue = 'This product no longer belongs to this store.';
    } else if (product.stock <= 0) {
      issue = 'This product is out of stock.';
    } else if (item.quantity > product.stock) {
      issue = `Only ${product.stock} left in stock.`;
    }

    return {
      productId: item.productId.toHexString(),
      quantity: item.quantity,
      name: product.name,
      imageUrl: product.imageUrl,
      pricePaise,
      lineTotalPaise,
      stock: product.stock,
      isAvailable: issue === null,
      issue,
    };
  });

  const subtotalPaise = items.reduce(
    (total, item) => total + item.lineTotalPaise,
    0,
  );

  return {
    id: cart._id!.toHexString(),
    store: store ? toStoreSummary(store) : null,
    items,
    subtotalPaise,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    hasIssues: items.some((item) => !item.isAvailable),
    updatedAt: cart.updatedAt,
  };
}
