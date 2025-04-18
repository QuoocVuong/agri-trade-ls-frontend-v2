// src/app/features/usermanagement/dto/request/FarmerProfileRequest.ts
import BigDecimal from 'js-big-decimal';

export interface FarmerProfileRequest {
  farmName: string;
  description?: string | null;
  addressDetail?: string | null;
  provinceCode: string;
  districtCode?: string | null;
  wardCode?: string | null;
  coverImageUrl?: string | null;
  canSupplyB2b?: boolean;
  b2bCertifications?: string | null;
  minB2bOrderValue?: number | string | BigDecimal | null; // Hoặc chỉ dùng number/string
}
