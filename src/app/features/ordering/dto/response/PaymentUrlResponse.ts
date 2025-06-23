import { PaymentMethod } from '../../domain/payment-method.enum';

export interface PaymentUrlResponse {
  paymentUrl: string;         // URL mà frontend sẽ redirect người dùng đến để thanh toán
  paymentMethod: PaymentMethod | string; // Phương thức thanh toán tương ứng (VNPAY, MOMO, etc.)

}
