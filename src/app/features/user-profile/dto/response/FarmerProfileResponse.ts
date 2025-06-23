// src/app/features/user-profile/dto/response/FarmerProfileResponse.ts
import BigDecimal from 'js-big-decimal';


import { VerificationStatus } from '../../../../common/model/verification-status.enum';

export interface FarmerProfileResponse {
  userId: number;
  farmName: string | null;
  description: string | null;
  addressDetail: string | null;
  provinceCode: string | null;
  districtCode: string | null;
  wardCode: string | null;
  coverImageUrl: string | null;
  verificationStatus: VerificationStatus | string; // Nên dùng Enum nếu có
  verifiedAt: string | null; // ISO date string
  verifiedByAdminName: string | null;
  canSupplyB2b: boolean;
  b2bCertifications: string | null;
  minB2bOrderValue: number | string | BigDecimal | null;

  address: string | null;
  status: VerificationStatus | string;


  fullName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  createdAt: string | null; // Ngày tham gia User


  // updatedAt của profile (nếu cần)
  updatedAt?: string | null; // Thêm ? nếu có thể không có
}
