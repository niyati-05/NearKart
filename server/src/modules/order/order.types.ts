import type { ObjectId } from 'mongodb';
import type { GeoPoint } from '../../lib/geo.js';
import type { DeliveryRouteSnapshot } from '../delivery/delivery.types.js';
import type { StoreSummary } from '../store/store.types.js';

export const orderStatuses = [
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'delivered',
  'cancelled',
] as const;

export type OrderStatus = (typeof orderStatuses)[number];

/** Statuses a seller is allowed to select, subject to transition rules. */
export const sellerOrderStatuses = [
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'delivered',
  'cancelled',
] as const;

export type SellerOrderStatus = (typeof sellerOrderStatuses)[number];

export const orderStatusTransitions: Record<
  OrderStatus,
  readonly OrderStatus[]
> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['delivered'],
  delivered: [],
  cancelled: [],
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface OrderItemSnapshot {
  productId: ObjectId;
  name: string;
  imageUrl: string;
  pricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  /**
   * Populated by the server from the Google Routes response. It is never
   * accepted from the browser and is not exposed to sellers.
   */
  location?: GeoPoint;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  changedAt: Date;
  changedByRole: 'customer' | 'seller' | 'admin' | 'system';
  changedById?: ObjectId;
  note?: string;
}

export interface Order {
  _id?: ObjectId;
  orderNumber: string;
  customerId: ObjectId;
  storeId: ObjectId;
  sellerId: ObjectId;
  items: OrderItemSnapshot[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  deliveryFeeStatus: 'pending_maps_integration' | 'calculated';
  totalPaise: number;
  deliveryAddress: DeliveryAddress;
  deliveryRoute?: DeliveryRouteSnapshot;
  deliveryQuoteMessage?: string;
  status: OrderStatus;
  statusHistory: OrderStatusHistoryEntry[];
  idempotencyKey: string;
  stockAdjusted: boolean;
  stockRestored?: boolean;
  cancellationReason?: string;
  placedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicOrderItem {
  productId: string;
  name: string;
  imageUrl: string;
  pricePaise: number;
  quantity: number;
  lineTotalPaise: number;
}

export interface PublicOrderStatusEntry {
  status: OrderStatus;
  changedAt: Date;
  changedByRole: 'customer' | 'seller' | 'admin' | 'system';
  note?: string;
}

export interface PublicOrder {
  id: string;
  orderNumber: string;
  store: StoreSummary;
  items: PublicOrderItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  deliveryFeeStatus: 'pending_maps_integration' | 'calculated';
  totalPaise: number;
  deliveryAddress: DeliveryAddress;
  deliveryRoute?: DeliveryRouteSnapshot;
  deliveryQuoteMessage?: string;
  status: OrderStatus;
  statusHistory: PublicOrderStatusEntry[];
  placedAt: Date;
  updatedAt: Date;
}

export interface SellerOrderCustomer {
  fullName: string;
  phone: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SellerDeliveryRouteSummary {
  distanceMeters: number;
  durationSeconds: number;
}

export interface SellerOrder {
  id: string;
  orderNumber: string;
  store: StoreSummary;
  customer: SellerOrderCustomer;
  items: PublicOrderItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  deliveryFeeStatus: 'pending_maps_integration' | 'calculated';
  totalPaise: number;
  deliveryRouteSummary?: SellerDeliveryRouteSummary;
  deliveryQuoteMessage?: string;
  status: OrderStatus;
  statusHistory: PublicOrderStatusEntry[];
  stockRestored?: boolean;
  cancellationReason?: string;
  placedAt: Date;
  updatedAt: Date;
}

function publicItems(order: Order): PublicOrderItem[] {
  return order.items.map((item) => ({
    productId: item.productId.toHexString(),
    name: item.name,
    imageUrl: item.imageUrl,
    pricePaise: item.pricePaise,
    quantity: item.quantity,
    lineTotalPaise: item.lineTotalPaise,
  }));
}

function publicHistory(order: Order): PublicOrderStatusEntry[] {
  return order.statusHistory.map((entry) => ({
    status: entry.status,
    changedAt: entry.changedAt,
    changedByRole: entry.changedByRole,
    ...(entry.note ? { note: entry.note } : {}),
  }));
}

export function toPublicOrder(order: Order, store: StoreSummary): PublicOrder {
  return {
    id: order._id!.toHexString(),
    orderNumber: order.orderNumber,
    store,
    items: publicItems(order),
    subtotalPaise: order.subtotalPaise,
    deliveryFeePaise: order.deliveryFeePaise,
    deliveryFeeStatus: order.deliveryFeeStatus,
    totalPaise: order.totalPaise,
    deliveryAddress: order.deliveryAddress,
    ...(order.deliveryRoute ? { deliveryRoute: order.deliveryRoute } : {}),
    ...(order.deliveryQuoteMessage
      ? { deliveryQuoteMessage: order.deliveryQuoteMessage }
      : {}),
    status: order.status,
    statusHistory: publicHistory(order),
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Sellers receive the contact details and area needed to prepare an order.
 * Street lines are intentionally withheld under the repository privacy rule;
 * the customer and future assigned driver see the full address.
 */
export function toSellerOrder(order: Order, store: StoreSummary): SellerOrder {
  return {
    id: order._id!.toHexString(),
    orderNumber: order.orderNumber,
    store,
    customer: {
      fullName: order.deliveryAddress.fullName,
      phone: order.deliveryAddress.phone,
      city: order.deliveryAddress.city,
      state: order.deliveryAddress.state,
      postalCode: order.deliveryAddress.postalCode,
      country: order.deliveryAddress.country,
    },
    items: publicItems(order),
    subtotalPaise: order.subtotalPaise,
    deliveryFeePaise: order.deliveryFeePaise,
    deliveryFeeStatus: order.deliveryFeeStatus,
    totalPaise: order.totalPaise,
    ...(order.deliveryRoute
      ? {
          deliveryRouteSummary: {
            distanceMeters: order.deliveryRoute.distanceMeters,
            durationSeconds: order.deliveryRoute.durationSeconds,
          },
        }
      : {}),
    ...(order.deliveryQuoteMessage
      ? { deliveryQuoteMessage: order.deliveryQuoteMessage }
      : {}),
    status: order.status,
    statusHistory: publicHistory(order),
    ...(order.stockRestored !== undefined
      ? { stockRestored: order.stockRestored }
      : {}),
    ...(order.cancellationReason
      ? { cancellationReason: order.cancellationReason }
      : {}),
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
  };
}
