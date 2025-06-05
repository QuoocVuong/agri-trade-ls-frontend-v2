import {PaymentMethod} from '../../domain/payment-method.enum';
import {AgreedOrderItemRequest} from './AgreedOrderItemRequest';

export interface AgreedOrderRequest {
  buyerId: number;
  //farmerId: number; // Sẽ tự điền nếu farmer tạo
  items: AgreedOrderItemRequest[];
  agreedTotalAmount: number | string;
  agreedPaymentMethod: PaymentMethod;
  shippingFullName?: string | null;
  shippingPhoneNumber?: string | null;
  shippingAddressDetail?: string | null;
  shippingProvinceCode?: string | null;
  shippingDistrictCode?: string | null;
  shippingWardCode?: string | null;
  notes?: string | null;
  expectedDeliveryDate?: string | null; // Dạng YYYY-MM-DD
}
