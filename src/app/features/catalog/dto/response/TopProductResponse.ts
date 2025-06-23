// src/app/features/catalog/dto/response/TopProductResponse.ts
import  BigDecimal  from 'js-big-decimal';

export interface TopProductResponse {
  productId: number;
  productName: string;
  productSlug: string;
  thumbnailUrl: string | null; // URL ảnh đại diện
  totalQuantitySold: number;
  totalRevenueGenerated: number | string | BigDecimal; // Tổng doanh thu từ sản phẩm này
}
