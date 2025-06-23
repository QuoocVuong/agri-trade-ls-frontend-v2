import BigDecimal from 'js-big-decimal';
import { OrderType } from '../../domain/order-type.enum';

export interface OrderCalculationResponse {
  subTotal: number | string | BigDecimal;
  shippingFee: number | string | BigDecimal;
  discountAmount: number | string | BigDecimal;
  totalAmount: number | string | BigDecimal;
  calculatedOrderType: OrderType; // Loại đơn hàng đã xác định (B2B/B2C)

}

