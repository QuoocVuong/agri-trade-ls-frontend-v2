// src/app/features/catalog/dto/response/TopProductResponse.ts
import  BigDecimal  from 'js-big-decimal'; // Hoặc dùng number/string

/**
 * Thông tin tóm tắt về sản phẩm bán chạy nhất.
 */
export interface TopProductResponse {
  productId: number;
  productName: string;
  productSlug: string;
  thumbnailUrl: string | null; // URL ảnh đại diện
  totalQuantitySold: number; // Tổng số lượng đã bán (thường là long ở backend)
  totalRevenueGenerated: number | string | BigDecimal; // Tổng doanh thu từ sản phẩm này
}
