// src/app/features/ordering/dto/response/OrderSummaryResponse.ts
import { OrderStatus } from '../../domain/order-status.enum';
import { OrderType } from '../../domain/order-type.enum';
import { PaymentStatus } from '../../domain/payment-status.enum';
import  BigDecimal  from 'js-big-decimal';
import {PaymentMethod} from '../../domain/payment-method.enum';

export interface OrderSummaryResponse {
  id: number;
  orderCode: string;
  orderType: OrderType;
  totalAmount: number | string | BigDecimal;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  createdAt: string; // ISO date string

  buyerName?: string;
  farmerName?: string; // Hoặc farmName

}
