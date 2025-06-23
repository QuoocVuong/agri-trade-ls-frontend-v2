// src/app/features/ordering/dto/request/CheckoutRequest.ts
import { PaymentMethod } from '../../domain/payment-method.enum';

// DTO cho việc tạo địa chỉ mới ngay lúc checkout
export interface NewAddressRequest {
  fullName: string;
  phoneNumber: string;
  addressDetail: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;

}

export interface CheckoutRequest {
  shippingAddressId?: number | null; // ID của địa chỉ đã lưu (bắt buộc nếu không có newShippingAddress)
  newShippingAddress?: NewAddressRequest | null; // Thông tin địa chỉ mới (bắt buộc nếu không có shippingAddressId)
  paymentMethod: PaymentMethod; // Enum PaymentMethod
  notes?: string | null;
  confirmedTotalAmount?: number | string | null;
  purchaseOrderNumber?: string | null;
}
