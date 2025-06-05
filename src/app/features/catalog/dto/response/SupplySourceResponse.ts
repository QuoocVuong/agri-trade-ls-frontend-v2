// src/app/features/catalog/dto/response/SupplySourceResponse.ts

import { ProductImageResponse } from "./ProductImageResponse";
import {FarmerSummaryResponse} from '../../../user-profile/dto/response/FarmerSummaryResponse'; // Nếu cần ảnh chi tiết hơn thumbnail

export interface SupplySourceResponse {
  farmerInfo: FarmerSummaryResponse;
  productId: number;
  productName: string;
  productSlug: string;
  thumbnailUrl: ProductImageResponse | null;
  currentStockQuantity: number;
  wholesaleUnit: string | null;
  referenceWholesalePrice: number | string | null; // Backend có thể trả về string hoặc number
  harvestDate: string | null; // Dạng ISO string date "YYYY-MM-DD"
  lastStockUpdate: string | null; // Dạng ISO string datetime
  negotiablePrice: boolean;
  // Thêm các trường khác từ Product nếu cần
  // ví dụ: description, averageRating, categoryName, etc.
}
