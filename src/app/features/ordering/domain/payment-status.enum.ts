// src/app/features/ordering/domain/payment-status.enum.ts
// Trạng thái thanh toán tổng thể của đơn hàng
export enum PaymentStatus {
  PENDING = 'PENDING',                     // Chờ thanh toán (chưa thanh toán hoặc đang chờ xử lý)
  PAID = 'PAID',                         // Đã thanh toán thành công
  FAILED = 'FAILED',                       // Thanh toán thất bại / Bị hủy
  REFUNDED = 'REFUNDED',                   // Đã hoàn tiền
  AWAITING_PAYMENT_TERM = 'AWAITING_PAYMENT_TERM' // Chờ thanh toán theo hạn (cho B2B Invoice)
}

// Optional: Hàm lấy text tiếng Việt
export function getPaymentStatusText(status: PaymentStatus | string | undefined | null): string {
  switch (status) {
    case PaymentStatus.PENDING: return 'Chờ thanh toán';
    case PaymentStatus.PAID: return 'Đã thanh toán';
    case PaymentStatus.FAILED: return 'Thanh toán thất bại';
    case PaymentStatus.REFUNDED: return 'Đã hoàn tiền';
    case PaymentStatus.AWAITING_PAYMENT_TERM: return 'Chờ thanh toán (Công nợ)';
    default: return 'Không xác định';
  }
}

// Optional: Hàm lấy màu sắc tương ứng
export function getPaymentStatusCssClass(status: PaymentStatus | string | undefined | null): string {
  switch (status) {
    case PaymentStatus.PENDING: return 'badge-warning';
    case PaymentStatus.PAID: return 'badge-success';
    case PaymentStatus.FAILED: return 'badge-error';
    case PaymentStatus.REFUNDED: return 'badge-neutral';
    case PaymentStatus.AWAITING_PAYMENT_TERM: return 'badge-info';
    default: return 'badge-ghost';
  }
}
