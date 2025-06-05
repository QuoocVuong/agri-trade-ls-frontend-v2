import { ProductStatus } from '../../domain/product-status.enum';
import { FarmerInfoResponse } from './FarmerInfoResponse';
import BigDecimal from 'js-big-decimal';
import { CategoryInfoResponse } from './CategoryInfoResponse';
import { ProductPricingTierResponse } from './ProductPricingTierResponse';

export interface ProductSummaryResponse {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null;

  // Giá B2C
  price: number | string | BigDecimal;
  unit: string;

  // Tồn kho và đánh giá
  stockQuantity: number;
  averageRating: number | null;

  // Nông dân và địa lý
  farmerInfo: FarmerInfoResponse | null;
  provinceCode: string | null;

  // Trạng thái và phân loại
  status: ProductStatus;
  category: CategoryInfoResponse | null;

  // Thời gian
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  lastStockUpdate?: Date | string | null;

  // B2B thông tin
  b2bEnabled: boolean;
  b2bUnit: string | null;
  b2bBasePrice: number | string | BigDecimal | null;
  minB2bQuantity?: number | null;
  pricingTiers?: ProductPricingTierResponse[] | null;

  // Thông tin nông sản
  harvestDate?: Date | string | null;
  negotiablePrice?: boolean;
  wholesaleUnit?: string | null;
  referenceWholesalePrice?: number | string | BigDecimal | null;

  // UI bổ sung
  isFavorite: boolean;
  favoriteCount?: number;
  new?: boolean;

  // Optional mô tả nếu có
  description?: string | null;
}
