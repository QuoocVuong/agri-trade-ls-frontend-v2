// src/app/features/catalog/dto/response/ProductDetailResponse.ts
import { ProductStatus } from '../../domain/product-status.enum';
import { CategoryInfoResponse } from './CategoryInfoResponse';
import { FarmerInfoResponse } from './FarmerInfoResponse';
import { ProductImageResponse } from './ProductImageResponse';
import { ProductPricingTierResponse } from './ProductPricingTierResponse'; // Import nếu dùng
import BigDecimal  from 'js-big-decimal';
import {ProductSummaryResponse} from './ProductSummaryResponse'; // Hoặc dùng number/string
//import { ReviewResponse } from '../../../interaction/dto/response/ReviewResponse'; // Import Review nếu muốn nhúng

export interface ProductDetailResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number | string | BigDecimal; // Giá B2C
  unit: string; // Đơn vị B2C
  stockQuantity: number;
  averageRating: number | null;
  ratingCount: number;
  favoriteCount: number;
  status: ProductStatus;
  rejectReason: string | null; // Lý do từ chối (nếu có)
  provinceCode: string | null;

  // Thông tin liên kết
  category: CategoryInfoResponse | null;
  farmer: FarmerInfoResponse | null;
  images: ProductImageResponse[]; // Danh sách ảnh
  // Có thể nhúng một vài review gần đây/nổi bật
  // recentReviews?: ReviewResponse[];

  // Thông tin B2B
  b2bEnabled : boolean;
  b2bUnit: string | null;
  minB2bQuantity: number | null;
  b2bBasePrice: number | string | BigDecimal | null;
  pricingTiers?: ProductPricingTierResponse[] | null; // Danh sách bậc giá (nếu dùng)
  // *** Thêm dòng này ***
  relatedProducts?: ProductSummaryResponse[] | null; // Danh sách sản phẩm liên quan

  createdAt: string; // ISO date string
  updatedAt: string;
}
