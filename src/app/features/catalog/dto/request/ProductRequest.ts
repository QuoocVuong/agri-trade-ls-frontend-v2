// src/app/features/catalog/dto/request/ProductRequest.ts
import { ProductImageRequest } from './ProductImageRequest';
import { ProductPricingTierRequest } from './ProductPricingTierRequest'; // Import nếu dùng
import { ProductStatus } from '../../domain/product-status.enum'; // Import Enum Status
import BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

export interface ProductRequest {
  name: string;
  categoryId: number;
  description?: string | null;
  unit: string; // B2C unit
  price: number | string | BigDecimal; // B2C price, dùng number hoặc string để dễ nhập liệu
  stockQuantity: number;
  status?: ProductStatus; // Farmer chỉ nên gửi DRAFT/UNPUBLISHED
  b2bEnabled ?: boolean;
  b2bUnit?: string | null;
  minB2bQuantity?: number | null;
  b2bBasePrice?: number | string | BigDecimal | null;
  images?: ProductImageRequest[] | null; // Danh sách thông tin ảnh
  pricingTiers?: ProductPricingTierRequest[] | null; // Danh sách bậc giá (nếu dùng)
}
