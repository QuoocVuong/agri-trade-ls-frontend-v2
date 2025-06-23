// src/app/features/ordering/dto/response/CartItemResponse.ts
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import  BigDecimal  from 'js-big-decimal';

export interface CartItemResponse {
  id: number;
  quantity: number;
  addedAt: string; // ISO date string
  updatedAt: string;
  product: ProductSummaryResponse | null; // Thông tin tóm tắt sản phẩm
  itemTotal?: number | string | BigDecimal | null; // Giá trị tạm tính (có thể tính ở frontend hoặc backend trả về)
}
