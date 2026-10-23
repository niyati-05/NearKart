import {
  ORDER_STATUS_LABELS,
  type OrderStatus,
} from '../../api/orders';

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status order-status--${status}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
