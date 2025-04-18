// src/app/features/ordering/dto/request/PaymentCallbackRequest.ts
// Cấu trúc này chỉ là VÍ DỤ, cần thay đổi theo cổng thanh toán thực tế
export interface PaymentCallbackRequest {
  orderCode?: string;
  transactionCode?: string;
  success?: boolean;
  amount?: number; // Hoặc string/BigDecimal tùy backend xử lý
  signature?: string;
  errorMessage?: string;
  // Thêm các trường khác...
  [key: string]: any; // Cho phép các trường động khác từ callback
}
