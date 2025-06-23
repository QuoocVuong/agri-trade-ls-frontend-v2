// src/app/features/ordering/dto/request/PaymentCallbackRequest.ts
// Cấu trúc này chỉ là VÍ DỤ, cần thay đổi theo cổng thanh toán thực tế
export interface PaymentCallbackRequest {
  orderCode?: string;
  transactionCode?: string;
  success?: boolean;
  amount?: number;
  signature?: string;
  errorMessage?: string;

  [key: string]: any; // Cho phép các trường động khác từ callback
}
