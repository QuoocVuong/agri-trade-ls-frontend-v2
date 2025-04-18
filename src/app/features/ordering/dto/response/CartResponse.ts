// src/app/features/ordering/dto/response/CartResponse.ts
import { CartItemResponse } from './CartItemResponse';
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

export interface CartResponse {
  items: CartItemResponse[];
  subTotal: number | string | BigDecimal; // Tổng tiền hàng tạm tính
  totalItems: number; // Tổng số lượng sản phẩm
}
