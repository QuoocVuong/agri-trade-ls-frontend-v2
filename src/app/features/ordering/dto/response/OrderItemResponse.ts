// src/app/features/ordering/dto/response/OrderItemResponse.ts
import { ProductInfoResponse } from '../../../catalog/dto/response/ProductInfoResponse'; // Import DTO SP cơ bản
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

export interface OrderItemResponse {
  id: number;
  quantity: number;
  unit: string;
  pricePerUnit: number | string | BigDecimal;
  totalPrice: number | string | BigDecimal;
  product: ProductInfoResponse | null; // Thông tin cơ bản SP tại thời điểm mua
}
