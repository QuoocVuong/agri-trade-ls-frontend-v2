// src/app/features/ordering/domain/payment-transaction-status.enum.ts
// Trạng thái của một giao dịch thanh toán cụ thể (trong bảng Payments)
export enum PaymentTransactionStatus {
  PENDING = 'PENDING',     // Đang chờ xử lý / Chưa có kết quả
  SUCCESS = 'SUCCESS',     // Giao dịch thành công
  FAILED = 'FAILED',       // Giao dịch thất bại
  CANCELLED = 'CANCELLED', // Giao dịch bị hủy (bởi người dùng hoặc hệ thống)
  REFUNDED = 'REFUNDED'    // Giao dịch đã được hoàn tiền
}
