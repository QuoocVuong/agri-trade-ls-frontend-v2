import { PaymentMethod } from '../../domain/payment-method.enum'; // Đảm bảo đường dẫn đúng

export interface SupplyOrderPlacementRequest {
  farmerId: number;
  productId: number;
  requestedQuantity: number;
  requestedUnit: string;
  proposedPricePerUnit?: number | string | null; // Cho phép string để dễ nhập
  buyerNotes?: string | null;
  shippingFullName?: string | null;
  shippingPhoneNumber?: string | null;
  shippingAddressDetail?: string | null;
  shippingProvinceCode?: string | null;
  shippingDistrictCode?: string | null;
  shippingWardCode?: string | null;
  expectedDeliveryDate?: string | null; // YYYY-MM-DD
}
