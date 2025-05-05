import BigDecimal from 'js-big-decimal'; // Hoặc dùng number/string nếu backend trả về number/string
import { OrderType } from '../../domain/order-type.enum'; // Import OrderType enum

export interface OrderCalculationResponse {
  subTotal: number | string | BigDecimal;
  shippingFee: number | string | BigDecimal;
  discountAmount: number | string | BigDecimal;
  totalAmount: number | string | BigDecimal;
  calculatedOrderType: OrderType; // Loại đơn hàng đã xác định (B2B/B2C)
  // Có thể thêm các trường khác nếu backend trả về, ví dụ:
  // items?: CalculatedOrderItem[]; // Chi tiết item với giá đã tính
  // applicableVoucher?: VoucherInfo; // Thông tin voucher đã áp dụng
}

// (Tùy chọn) Định nghĩa interface cho item đã tính toán nếu cần
// export interface CalculatedOrderItem {
//   productId: number;
//   quantity: number;
//   unit: string; // Đơn vị đúng (B2B/B2C)
//   pricePerUnit: number | string | BigDecimal; // Giá đúng (B2B/B2C)
//   itemTotal: number | string | BigDecimal;
// }

// (Tùy chọn) Định nghĩa interface cho thông tin voucher
// export interface VoucherInfo {
//   code: string;
//   discountValue: number | string | BigDecimal;
//   // ...
// }
