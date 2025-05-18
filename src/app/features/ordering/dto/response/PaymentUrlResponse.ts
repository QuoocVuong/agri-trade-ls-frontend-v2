import { PaymentMethod } from '../../domain/payment-method.enum'; // Import PaymentMethod enum nếu cần

export interface PaymentUrlResponse {
  paymentUrl: string;         // URL mà frontend sẽ redirect người dùng đến để thanh toán
  paymentMethod: PaymentMethod | string; // Phương thức thanh toán tương ứng (VNPAY, MOMO, etc.)
  // Có thể dùng string nếu không muốn import enum ở đây
  // Bạn có thể thêm các trường khác nếu backend trả về, ví dụ:
  // orderCode?: string; // Mã đơn hàng của hệ thống bạn
  // transactionReference?: string; // Mã tham chiếu giao dịch của cổng thanh toán (nếu có ở bước này)
}
