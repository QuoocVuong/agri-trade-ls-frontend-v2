// src/app/features/catalog/dto/response/ProductSummaryResponse.ts
import { ProductStatus } from '../../domain/product-status.enum'; // Import Enum Status
import { FarmerInfoResponse } from './FarmerInfoResponse';
import  BigDecimal  from 'js-big-decimal';
import {CategoryInfoResponse} from './CategoryInfoResponse'; // Hoặc dùng number/string

export interface ProductSummaryResponse {
  id: number;
  name: string;

  slug: string;
  thumbnailUrl: string | null;
  price: number | string | BigDecimal; // Giá B2C, dùng number hoặc string
  unit: string; // Đơn vị B2C
  averageRating: number | null;
  farmerInfo: FarmerInfoResponse | null; // Thông tin cơ bản của farmer
  provinceCode: string | null;
  status: ProductStatus;
  b2bEnabled : boolean;
  b2bUnit: string | null;
  b2bBasePrice: number | string | BigDecimal | null; // Hoặc kiểu dữ liệu bạn dùng
  category: CategoryInfoResponse | null;
  stockQuantity: number;
  description: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  isFavorite: boolean;
  isNew: boolean;

  // Có thể thêm favorite count nếu cần hiển thị nhanh
  // favoriteCount?: number;
}
