// src/app/features/usermanagement/dto/response/FarmerProfileResponse.ts
// Import các Enum nếu cần (ví dụ VerificationStatus)
// import { VerificationStatus } from 'path/to/enums';
import BigDecimal from 'js-big-decimal';

export interface FarmerProfileResponse {
  userId: number;
  farmName: string;
  description: string | null;
  addressDetail: string | null;
  provinceCode: string | null;
  districtCode: string | null;
  wardCode: string | null;
  coverImageUrl: string | null;
  verificationStatus: string; // 'PENDING', 'VERIFIED', 'REJECTED'
  verifiedAt: string | null; // ISO date string
  verifiedByAdminName: string | null;
  canSupplyB2b: boolean;
  b2bCertifications: string | null;
  minB2bOrderValue: number | string | BigDecimal | null; // Hoặc chỉ number/string
  createdAt: string;
  updatedAt: string;
}
