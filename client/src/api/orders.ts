import { apiRequest } from './client';
import type {
  DeliveryRoute,
  DeliveryRouteSummary,
  GeoPoint,
} from './maps';

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'delivered'
  | 'cancelled';

export type SellerOrderStatus = Exclude<OrderStatus, 'pending'>;

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export interface OrderStore {
  id: string;
  name: string;
  slug: string;
  city: string;
  location?: GeoPoint;
}

export interface OrderItem {
  productId: string;
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
  /** Server-populated route destination; never supplied by the browser. */
  location?: GeoPoint;
}

export interface OrderStatusEntry {
  status: OrderStatus;
  changedAt: string;
  changedByRole: 'customer' | 'seller' | 'admin' | 'system';
  note?: string;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  store: OrderStore;
  items: OrderItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  deliveryFeeStatus: 'pending_maps_integration' | 'calculated';
  totalPaise: number;
  deliveryAddress: DeliveryAddress;
  deliveryRoute?: DeliveryRoute;
  deliveryQuoteMessage?: string;
  status: OrderStatus;
  statusHistory: OrderStatusEntry[];
  placedAt: string;
  updatedAt: string;
}

export interface SellerOrderCustomer {
  fullName: string;
  phone: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface SellerOrder {
  id: string;
  orderNumber: string;
  store: OrderStore;
  customer: SellerOrderCustomer;
  items: OrderItem[];
  subtotalPaise: number;
  deliveryFeePaise: number;
  deliveryFeeStatus: 'pending_maps_integration' | 'calculated';
  totalPaise: number;
  deliveryRouteSummary?: DeliveryRouteSummary;
  deliveryQuoteMessage?: string;
  status: OrderStatus;
  statusHistory: OrderStatusEntry[];
  stockRestored?: boolean;
  cancellationReason?: string;
  placedAt: string;
  updatedAt: string;
}

export interface OrderListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PlaceOrderInput {
  idempotencyKey: string;
  deliveryAddress: DeliveryAddress;
}

interface CustomerOrderResponse {
  order: CustomerOrder;
}

interface SellerOrderResponse {
  order: SellerOrder;
}

export function placeOrder(input: PlaceOrderInput): Promise<CustomerOrderResponse> {
  return apiRequest<CustomerOrderResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getOrders(
  page = 1,
  limit = 20,
): Promise<OrderListResponse<CustomerOrder>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return apiRequest<OrderListResponse<CustomerOrder>>(`/orders?${params}`);
}

export function getOrder(orderId: string): Promise<CustomerOrderResponse> {
  return apiRequest<CustomerOrderResponse>(`/orders/${orderId}`);
}

export function getSellerOrders(
  page = 1,
  limit = 20,
  status?: OrderStatus,
): Promise<OrderListResponse<SellerOrder>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status) {
    params.set('status', status);
  }
  return apiRequest<OrderListResponse<SellerOrder>>(
    `/seller/orders?${params}`,
  );
}

export function updateSellerOrderStatus(
  orderId: string,
  status: SellerOrderStatus,
  note?: string,
): Promise<SellerOrderResponse> {
  return apiRequest<SellerOrderResponse>(`/seller/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note ? { note } : {}) }),
  });
}
