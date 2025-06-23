// src/app/features/catalog/dto/response/SupplySourceResponse.ts

import { ProductImageResponse } from "./ProductImageResponse";
import {FarmerSummaryResponse} from '../../../user-profile/dto/response/FarmerSummaryResponse';

export interface SupplySourceResponse {
  farmerInfo: FarmerSummaryResponse;
  productId: number;
  productName: string;
  productSlug: string;
  thumbnailUrl: ProductImageResponse | null;
  currentStockQuantity: number;
  wholesaleUnit: string | null;
  referenceWholesalePrice: number | string | null;
  harvestDate: string | null; // Dạng ISO string date "YYYY-MM-DD"
  lastStockUpdate: string | null; // Dạng ISO string datetime
  negotiablePrice: boolean;

}
