// src/app/features/ordering/dto/response/OrderResponse.ts
import { FarmerInfoResponse } from '../../../catalog/dto/response/FarmerInfoResponse';
import { UserResponse } from '../../../user-profile/dto/response/UserResponse';
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { PaymentMethod } from '../../domain/payment-method.enum';
import { PaymentStatus } from '../../domain/payment-status.enum';
import { OrderItemResponse } from './OrderItemResponse';
import { PaymentResponse } from './PaymentResponse';
import  BigDecimal  from 'js-big-decimal';
import {InvoiceInfoResponse} from './InvoiceInfoResponse';

export interface OrderResponse {
  id: number;
  orderCode: string;
  orderType: OrderType;
  buyer: UserResponse | null; // Thông tin người mua
  farmer: FarmerInfoResponse | null; // Thông tin người bán

  // Shipping Info
  shippingFullName: string;
  shippingPhoneNumber: string;
  shippingAddressDetail: string;
  shippingProvinceCode: string;
  shippingDistrictCode: string;
  shippingWardCode: string;

  // Values
  subTotal: number | string | BigDecimal;
  shippingFee: number | string | BigDecimal;
  discountAmount: number | string | BigDecimal;
  totalAmount: number | string | BigDecimal;

  // Status & Payment
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  notes: string | null;
  purchaseOrderNumber: string | null;

  // Details
  orderItems: OrderItemResponse[];
  payments?: PaymentResponse[] | null; // Lịch sử thanh toán (có thể optional)
  invoiceInfo?: InvoiceInfoResponse | null;

  createdAt: string; // ISO date string
  updatedAt: string;
}
