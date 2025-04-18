// src/app/features/ordering/domain/order-status.enum.ts
export enum OrderStatus {
  PENDING = 'PENDING',             // Chờ xác nhận
  CONFIRMED = 'CONFIRMED',           // Đã xác nhận (bởi Farmer/Admin)
  PROCESSING = 'PROCESSING',         // Đang chuẩn bị hàng
  SHIPPING = 'SHIPPING',           // Đang giao hàng
  DELIVERED = 'DELIVERED',           // Đã giao thành công
  CANCELLED = 'CANCELLED',           // Đã hủy (bởi Buyer/Admin/Farmer)
  RETURNED = 'RETURNED'            // Bị trả hàng (tùy chọn)
}

// Optional: Hàm lấy text tiếng Việt
export function getOrderStatusText(status: OrderStatus | string | undefined | null): string {
  switch (status) {
    case OrderStatus.PENDING: return 'Chờ xác nhận';
    case OrderStatus.CONFIRMED: return 'Đã xác nhận';
    case OrderStatus.PROCESSING: return 'Đang xử lý';
    case OrderStatus.SHIPPING: return 'Đang giao hàng';
    case OrderStatus.DELIVERED: return 'Đã giao hàng';
    case OrderStatus.CANCELLED: return 'Đã hủy';
    case OrderStatus.RETURNED: return 'Đã trả hàng';
    default: return 'Không xác định';
  }
}

// Optional: Hàm lấy màu sắc tương ứng (ví dụ cho badge DaisyUI)
export function getOrderStatusCssClass(status: OrderStatus | string | undefined | null): string {
  switch (status) {
    case OrderStatus.PENDING: return 'badge-warning';
    case OrderStatus.CONFIRMED: return 'badge-info';
    case OrderStatus.PROCESSING: return 'badge-info';
    case OrderStatus.SHIPPING: return 'badge-info';
    case OrderStatus.DELIVERED: return 'badge-success';
    case OrderStatus.CANCELLED: return 'badge-error';
    case OrderStatus.RETURNED: return 'badge-ghost';
    default: return 'badge-ghost';
  }
}
