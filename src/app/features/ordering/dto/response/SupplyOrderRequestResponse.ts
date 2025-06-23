import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse';
import { ProductInfoResponse } from '../../../catalog/dto/response/ProductInfoResponse';
import {SupplyOrderRequestStatus} from '../../domain/supply-order-request-status.enum';



export interface SupplyOrderRequestResponse {
  id: number;
  buyer: UserInfoSimpleResponse;
  farmer: UserInfoSimpleResponse;
  product: ProductInfoResponse;
  requestedQuantity: number;
  requestedUnit: string;
  proposedPricePerUnit: number | string | null;
  buyerNotes: string | null;
  shippingFullName: string | null;
  shippingPhoneNumber: string | null;
  shippingAddressDetail: string | null;
  shippingProvinceCode: string | null;
  shippingDistrictCode: string | null;
  shippingWardCode: string | null;
  expectedDeliveryDate: string | null; // YYYY-MM-DD
  status: SupplyOrderRequestStatus;
  farmerResponseMessage: string | null;
  createdAt: string; // ISO datetime string
  updatedAt: string; // ISO datetime string
}
