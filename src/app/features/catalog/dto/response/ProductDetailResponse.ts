import { ProductStatus } from '../../domain/product-status.enum';
import { CategoryInfoResponse } from './CategoryInfoResponse';
import { FarmerInfoResponse } from './FarmerInfoResponse';
import { ProductImageResponse } from './ProductImageResponse';
import { ProductPricingTierResponse } from './ProductPricingTierResponse';
import { ProductSummaryResponse } from './ProductSummaryResponse';
import BigDecimal from 'js-big-decimal';
// import { ReviewResponse } from '../../../interaction/dto/response/ReviewResponse'; // Nếu cần reviews chi tiết

export interface ProductDetailResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number | string | BigDecimal;
  unit: string;
  stockQuantity: number;
  averageRating: number | null;
  ratingCount: number;
  favoriteCount: number;
  status: ProductStatus;
  rejectReason: string | null;
  provinceCode: string | null;

  // Thông tin liên kết
  category: CategoryInfoResponse | null;
  farmer: FarmerInfoResponse | null;
  images: ProductImageResponse[];

  // B2B
  b2bEnabled: boolean;


  // Sản phẩm liên quan
  relatedProducts?: ProductSummaryResponse[] | null;

  // Thời gian
  createdAt: string;
  updatedAt: string;
  lastStockUpdate?: string | null;

  // Thông tin nông sản bổ sung
  harvestDate?: string | null;
  negotiablePrice?: boolean;
  wholesaleUnit?: string | null;
  referenceWholesalePrice?: number | string | BigDecimal | null;

  // Nếu sau này muốn hiển thị đánh giá cụ thể
  // reviews?: ReviewResponse[] | null;
}
