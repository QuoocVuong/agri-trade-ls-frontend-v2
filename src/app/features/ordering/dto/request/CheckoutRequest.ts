// src/app/features/ordering/dto/request/CheckoutRequest.ts
import { PaymentMethod } from '../../domain/payment-method.enum'; // Import Enum

// DTO cho việc tạo địa chỉ mới ngay lúc checkout (nếu hỗ trợ)
export interface NewAddressRequest {
  fullName: string;
  phoneNumber: string;
  addressDetail: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  // type?: 'SHIPPING'; // Mặc định là SHIPPING
  // isDefault?: boolean; // Có muốn lưu và đặt làm mặc định không?
}

export interface CheckoutRequest {
  shippingAddressId?: number | null; // ID của địa chỉ đã lưu (bắt buộc nếu không có newShippingAddress)
  newShippingAddress?: NewAddressRequest | null; // Thông tin địa chỉ mới (bắt buộc nếu không có shippingAddressId)
  paymentMethod: PaymentMethod; // Enum PaymentMethod
  notes?: string | null;
  confirmedTotalAmount?: number | string | null;
  purchaseOrderNumber?: string | null;
}
