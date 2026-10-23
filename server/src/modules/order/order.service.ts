import type { Filter, ObjectId, UpdateFilter } from 'mongodb';
import { ObjectId as ObjectIdValue } from 'mongodb';
import { getDb } from '../../db/client.js';
import { AppError } from '../../lib/app-error.js';
import { isDuplicateKeyError } from '../../lib/mongo-errors.js';
import {
  isDeliveryQuoteBlocking,
  quoteDeliveryForStore,
} from '../delivery/delivery.service.js';
import type { StoreSummary } from '../store/store.types.js';
import type { Store } from '../store/store.types.js';
import { toStoreSummary } from '../store/store.types.js';
import type { Product } from '../product/product.types.js';
import { clearCart, findCart } from '../cart/cart.service.js';
import type { CreateOrderInput, ListOrdersQuery, ListSellerOrdersQuery, UpdateOrderStatusInput } from './order.schemas.js';
import type {
  Order,
  OrderItemSnapshot,
  OrderStatus,
  PublicOrder,
  SellerOrder,
} from './order.types.js';
import {
  orderStatusTransitions,
  toPublicOrder,
  toSellerOrder,
} from './order.types.js';

interface ReservedStock {
  productId: ObjectId;
  quantity: number;
}

interface OrderListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function ordersCollection() {
  return getDb().collection<Order>('orders');
}

function productsCollection() {
  return getDb().collection<Product>('products');
}

function storesCollection() {
  return getDb().collection<Store>('stores');
}

function fallbackStoreSummary(storeId: ObjectId): StoreSummary {
  return {
    id: storeId.toHexString(),
    name: 'Store unavailable',
    slug: '',
    city: '',
  };
}

async function storeSummaryFor(storeId: ObjectId): Promise<StoreSummary> {
  const store = await storesCollection().findOne({ _id: storeId });
  return store ? toStoreSummary(store) : fallbackStoreSummary(storeId);
}

async function loadStoreSummaries(
  storeIds: ObjectId[],
): Promise<Map<string, StoreSummary>> {
  const uniqueIds = [
    ...new Map(storeIds.map((id) => [id.toHexString(), id])).values(),
  ];

  if (uniqueIds.length === 0) {
    return new Map();
  }

  const stores = await storesCollection()
    .find({ _id: { $in: uniqueIds } })
    .toArray();

  return new Map(
    stores.map((store) => [store._id!.toHexString(), toStoreSummary(store)]),
  );
}

function storeSummaryFromMap(
  map: Map<string, StoreSummary>,
  storeId: ObjectId,
): StoreSummary {
  return map.get(storeId.toHexString()) ?? fallbackStoreSummary(storeId);
}

async function sellerStore(sellerId: ObjectId): Promise<Store> {
  const store = await storesCollection().findOne({ ownerId: sellerId });

  if (!store) {
    throw new AppError(
      404,
      'STORE_NOT_FOUND',
      'Create a store profile before managing orders.',
    );
  }

  return store;
}

/**
 * Standalone MongoDB does not support multi-document transactions. We reserve
 * stock one product at a time with an atomic conditional update and release
 * earlier reservations if any later step fails. An order is only inserted
 * after every reservation succeeds, so a failed order can never be reported as
 * successful. The remaining crash window is documented in PROJECT_STATUS.md.
 */
async function releaseReservedStock(
  reservations: ReservedStock[],
): Promise<boolean> {
  let allReleased = true;

  for (const reservation of reservations) {
    try {
      const result = await productsCollection().updateOne(
        { _id: reservation.productId },
        {
          $inc: { stock: reservation.quantity },
          $set: { updatedAt: new Date() },
        },
      );
      if (result.matchedCount !== 1) {
        allReleased = false;
      }
    } catch (error) {
      allReleased = false;
      console.error(
        '[nearkart-api] Could not release reserved stock for product',
        reservation.productId.toHexString(),
        error,
      );
    }
  }

  return allReleased;
}

async function restoreOrderStock(order: Order): Promise<boolean> {
  let allRestored = true;

  for (const item of order.items) {
    try {
      const result = await productsCollection().updateOne(
        { _id: item.productId },
        {
          $inc: { stock: item.quantity },
          $set: { updatedAt: new Date() },
        },
      );
      if (result.matchedCount !== 1) {
        allRestored = false;
      }
    } catch (error) {
      allRestored = false;
      console.error(
        '[nearkart-api] Could not restore stock for cancelled order',
        order._id!.toHexString(),
        error,
      );
    }
  }

  return allRestored;
}

function reservationError(
  item: OrderItemSnapshot,
  latest: Product | null,
): AppError {
  if (!latest || !latest.isActive) {
    return new AppError(
      409,
      'PRODUCT_UNAVAILABLE',
      `${item.name} is no longer available. Update your cart and try again.`,
    );
  }

  if (latest.pricePaise !== item.pricePaise) {
    return new AppError(
      409,
      'PRICE_CHANGED',
      `The price of ${item.name} changed. Review your cart before ordering.`,
    );
  }

  if (latest.stock < item.quantity) {
    return new AppError(
      409,
      'INSUFFICIENT_STOCK',
      latest.stock === 0
        ? `${item.name} is now out of stock. Update your cart and try again.`
        : `Only ${latest.stock} of ${item.name} left in stock. Update your cart and try again.`,
    );
  }

  return new AppError(
    409,
    'STOCK_RESERVATION_FAILED',
    `Stock for ${item.name} could not be reserved. Please try again.`,
  );
}

function newOrderNumber(now: Date, orderId: ObjectId): string {
  const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `NK-${datePart}-${orderId.toHexString().slice(-6).toUpperCase()}`;
}

async function existingOrderByKey(
  idempotencyKey: string,
  customerId: ObjectId,
): Promise<Order | null> {
  const existing = await ordersCollection().findOne({ idempotencyKey });

  if (!existing) {
    return null;
  }

  if (existing.customerId.toHexString() !== customerId.toHexString()) {
    throw new AppError(
      409,
      'IDEMPOTENCY_CONFLICT',
      'This order request was already used by another account.',
    );
  }

  return existing;
}

export async function createOrder(
  customerId: ObjectId,
  input: CreateOrderInput,
): Promise<PublicOrder> {
  const existing = await existingOrderByKey(
    input.idempotencyKey,
    customerId,
  );

  if (existing) {
    return toPublicOrder(existing, await storeSummaryFor(existing.storeId));
  }

  const cart = await findCart(customerId);

  if (!cart || cart.items.length === 0) {
    throw new AppError(
      409,
      'CART_EMPTY',
      'Your cart is empty. Add products before checking out.',
    );
  }

  const store = await storesCollection().findOne({ _id: cart.storeId });

  if (!store || store.status !== 'active') {
    throw new AppError(
      409,
      'STORE_UNAVAILABLE',
      'This store is not accepting orders right now.',
    );
  }

  const productIds = cart.items.map((item) => item.productId);
  const products = await productsCollection()
    .find({ _id: { $in: productIds } })
    .toArray();
  const productMap = new Map(
    products.map((product) => [product._id!.toHexString(), product]),
  );

  const items: OrderItemSnapshot[] = [];

  for (const cartItem of cart.items) {
    const product = productMap.get(cartItem.productId.toHexString());

    if (
      !product ||
      !product.isActive ||
      product.storeId.toHexString() !== cart.storeId.toHexString()
    ) {
      throw new AppError(
        409,
        'PRODUCT_UNAVAILABLE',
        'One or more products in your cart are no longer available.',
      );
    }

    if (cartItem.quantity < 1 || cartItem.quantity > 99) {
      throw new AppError(
        409,
        'INVALID_QUANTITY',
        'One or more cart quantities are invalid.',
      );
    }

    if (product.stock < cartItem.quantity) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        product.stock === 0
          ? `${product.name} is out of stock.`
          : `Only ${product.stock} of ${product.name} left in stock.`,
      );
    }

    items.push({
      productId: product._id!,
      name: product.name,
      imageUrl: product.imageUrl,
      pricePaise: product.pricePaise,
      quantity: cartItem.quantity,
      lineTotalPaise: product.pricePaise * cartItem.quantity,
    });
  }

  const now = new Date();
  const orderId = new ObjectIdValue();
  const subtotalPaise = items.reduce(
    (total, item) => total + item.lineTotalPaise,
    0,
  );

  const deliveryAddress = {
    fullName: input.deliveryAddress.fullName,
    phone: input.deliveryAddress.phone,
    line1: input.deliveryAddress.line1,
    ...(input.deliveryAddress.line2
      ? { line2: input.deliveryAddress.line2 }
      : {}),
    city: input.deliveryAddress.city,
    state: input.deliveryAddress.state,
    postalCode: input.deliveryAddress.postalCode,
    country: input.deliveryAddress.country,
  };

  // The quote is recalculated here from the store's saved coordinates and the
  // delivery address. A client-submitted fee, distance or total is never used.
  const deliveryQuote = await quoteDeliveryForStore(
    store,
    deliveryAddress,
    subtotalPaise,
  );

  if (
    deliveryQuote.status === 'unavailable' &&
    isDeliveryQuoteBlocking(deliveryQuote.reason)
  ) {
    throw new AppError(
      409,
      deliveryQuote.reason === 'ROUTE_TOO_LONG'
        ? 'DELIVERY_OUT_OF_RANGE'
        : 'DELIVERY_QUOTE_UNAVAILABLE',
      deliveryQuote.message,
    );
  }

  const order: Order = {
    _id: orderId,
    orderNumber: newOrderNumber(now, orderId),
    customerId,
    storeId: cart.storeId,
    sellerId: store.ownerId,
    items,
    subtotalPaise,
    deliveryFeePaise: deliveryQuote.deliveryFeePaise,
    deliveryFeeStatus:
      deliveryQuote.status === 'calculated'
        ? 'calculated'
        : 'pending_maps_integration',
    totalPaise: deliveryQuote.totalPaise,
    deliveryAddress: {
      ...deliveryAddress,
      ...(deliveryQuote.status === 'calculated'
        ? { location: deliveryQuote.route.destination }
        : {}),
    },
    ...(deliveryQuote.status === 'calculated'
      ? { deliveryRoute: deliveryQuote.route }
      : {}),
    ...(deliveryQuote.status === 'unavailable'
      ? { deliveryQuoteMessage: deliveryQuote.message }
      : {}),
    status: 'pending',
    statusHistory: [
      {
        status: 'pending',
        changedAt: now,
        changedByRole: 'customer',
        changedById: customerId,
        note: 'Order placed',
      },
    ],
    idempotencyKey: input.idempotencyKey,
    stockAdjusted: true,
    placedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const reservations: ReservedStock[] = [];

  for (const item of items) {
    try {
      const reserved = await productsCollection().findOneAndUpdate(
        {
          _id: item.productId,
          storeId: cart.storeId,
          isActive: true,
          pricePaise: item.pricePaise,
          stock: { $gte: item.quantity },
        },
        {
          $inc: { stock: -item.quantity },
          $set: { updatedAt: new Date() },
        },
        { returnDocument: 'after' },
      );

      if (!reserved) {
        const latest = await productsCollection().findOne({
          _id: item.productId,
        });
        await releaseReservedStock(reservations);
        throw reservationError(item, latest);
      }

      reservations.push({
        productId: item.productId,
        quantity: item.quantity,
      });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      await releaseReservedStock(reservations);
      console.error('[nearkart-api] Stock reservation failed:', error);
      throw new AppError(
        500,
        'ORDER_FAILED',
        'Could not reserve stock for your order. Please try again.',
      );
    }
  }

  try {
    await ordersCollection().insertOne(order);
  } catch (error) {
    await releaseReservedStock(reservations);

    if (isDuplicateKeyError(error)) {
      const existingAfterRace = await existingOrderByKey(
        input.idempotencyKey,
        customerId,
      );
      if (existingAfterRace) {
        return toPublicOrder(
          existingAfterRace,
          await storeSummaryFor(existingAfterRace.storeId),
        );
      }
    }

    console.error('[nearkart-api] Order insert failed:', error);
    throw new AppError(
      500,
      'ORDER_FAILED',
      'Could not place your order. No order was created.',
    );
  }

  // The order and stock changes are already committed. A failed cart cleanup
  // must not turn a valid order into a failed request; it is safe to retry and
  // the stale cart will be replaced on the next add/checkout.
  try {
    await clearCart(customerId);
  } catch (error) {
    console.error('[nearkart-api] Could not clear cart after order:', error);
  }

  return toPublicOrder(order, toStoreSummary(store));
}

export async function listCustomerOrders(
  customerId: ObjectId,
  query: ListOrdersQuery,
): Promise<OrderListResult<PublicOrder>> {
  const filter: Filter<Order> = { customerId };
  if (query.status) {
    filter.status = query.status;
  }

  const pageSize = query.limit;
  const skip = (query.page - 1) * pageSize;

  const [orders, total] = await Promise.all([
    ordersCollection()
      .find(filter)
      .sort({ placedAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    ordersCollection().countDocuments(filter),
  ]);

  const storeSummaries = await loadStoreSummaries(
    orders.map((order) => order.storeId),
  );

  return {
    items: orders.map((order) =>
      toPublicOrder(
        order,
        storeSummaryFromMap(storeSummaries, order.storeId),
      ),
    ),
    total,
    page: query.page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getCustomerOrder(
  customerId: ObjectId,
  orderId: ObjectId,
): Promise<PublicOrder> {
  const order = await ordersCollection().findOne({
    _id: orderId,
    customerId,
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  return toPublicOrder(order, await storeSummaryFor(order.storeId));
}

export async function listSellerOrders(
  sellerId: ObjectId,
  query: ListSellerOrdersQuery,
): Promise<OrderListResult<SellerOrder>> {
  const store = await sellerStore(sellerId);
  const filter: Filter<Order> = { storeId: store._id! };
  if (query.status) {
    filter.status = query.status;
  }

  const pageSize = query.limit;
  const skip = (query.page - 1) * pageSize;

  const [orders, total] = await Promise.all([
    ordersCollection()
      .find(filter)
      .sort({ placedAt: -1, _id: -1 })
      .skip(skip)
      .limit(pageSize)
      .toArray(),
    ordersCollection().countDocuments(filter),
  ]);

  const storeSummary = toStoreSummary(store);

  return {
    items: orders.map((order) => toSellerOrder(order, storeSummary)),
    total,
    page: query.page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getSellerOrder(
  sellerId: ObjectId,
  orderId: ObjectId,
): Promise<SellerOrder> {
  const store = await sellerStore(sellerId);
  const order = await ordersCollection().findOne({
    _id: orderId,
    storeId: store._id,
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  return toSellerOrder(order, toStoreSummary(store));
}

export async function updateSellerOrderStatus(
  sellerId: ObjectId,
  orderId: ObjectId,
  input: UpdateOrderStatusInput,
): Promise<SellerOrder> {
  const store = await sellerStore(sellerId);
  const order = await ordersCollection().findOne({
    _id: orderId,
    storeId: store._id,
  });

  if (!order) {
    throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
  }

  const nextStatus: OrderStatus = input.status;
  const allowed = orderStatusTransitions[order.status];

  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      `An order that is ${order.status} cannot be changed to ${nextStatus}.`,
    );
  }

  const now = new Date();
  const historyEntry = {
    status: nextStatus,
    changedAt: now,
    changedByRole: 'seller' as const,
    changedById: sellerId,
    ...(input.note ? { note: input.note } : {}),
  };

  const update: UpdateFilter<Order> = {
    $set: {
      status: nextStatus,
      updatedAt: now,
      ...(nextStatus === 'cancelled'
        ? {
            cancellationReason: input.note ?? 'Cancelled by seller',
            stockRestored: false,
          }
        : {}),
    },
    $push: { statusHistory: historyEntry },
  };

  let updated = await ordersCollection().findOneAndUpdate(
    { _id: order._id, storeId: store._id, status: order.status },
    update,
    { returnDocument: 'after' },
  );

  if (!updated) {
    const latest = await ordersCollection().findOne({
      _id: order._id,
      storeId: store._id,
    });

    if (!latest) {
      throw new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');
    }

    throw new AppError(
      409,
      'ORDER_CHANGED',
      'This order was updated by another request. Refresh and try again.',
    );
  }

  if (nextStatus === 'cancelled' && order.stockAdjusted) {
    const restored = await restoreOrderStock(updated);

    if (restored) {
      const withStockFlag = await ordersCollection().findOneAndUpdate(
        { _id: order._id, storeId: store._id, status: 'cancelled' },
        { $set: { stockRestored: true, updatedAt: new Date() } },
        { returnDocument: 'after' },
      );

      if (withStockFlag) {
        updated = withStockFlag;
      }
    }
  }

  return toSellerOrder(updated, toStoreSummary(store));
}
