// src/app/features/ordering/dto/response/OrderItemResponse.ts
import { ProductInfoResponse } from '../../../catalog/dto/response/ProductInfoResponse';
import  BigDecimal  from 'js-big-decimal';

export interface OrderItemResponse {
  id: number;
  quantity: number;
  unit: string;
  pricePerUnit: number | string | BigDecimal;
  totalPrice: number | string | BigDecimal;
  product: ProductInfoResponse | null; // Thông tin cơ bản SP tại thời điểm mua
}
