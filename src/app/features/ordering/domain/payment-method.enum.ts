// src/app/features/ordering/domain/payment-method.enum.ts
export enum PaymentMethod {
  COD = 'COD',                     // Thanh toán khi nhận hàng
  BANK_TRANSFER = 'BANK_TRANSFER', // Chuyển khoản ngân hàng
  VNPAY = 'VNPAY',                 // Cổng thanh toán VNPay
  MOMO = 'MOMO',                   // Ví MoMo
  ZALOPAY = 'ZALOPAY',             // Ví ZaloPay
  INVOICE = 'INVOICE',             // Thanh toán theo hóa đơn (cho B2B)
  OTHER = 'OTHER'                  // Phương thức khác
}

// Optional: Hàm lấy text tiếng Việt
export function getPaymentMethodText(method: PaymentMethod | string | undefined | null): string {
  switch (method) {
    case PaymentMethod.COD: return 'Thanh toán khi nhận hàng';
    case PaymentMethod.BANK_TRANSFER: return 'Chuyển khoản ngân hàng';
    case PaymentMethod.VNPAY: return 'VNPay';
    case PaymentMethod.MOMO: return 'Ví MoMo';
    case PaymentMethod.ZALOPAY: return 'Ví ZaloPay';
    case PaymentMethod.INVOICE: return 'Thanh toán theo Hóa đơn';
    case PaymentMethod.OTHER: return 'Khác';
    default: return 'Không xác định';
  }
}
