// src/app/features/user-profile/dto/response/FarmerProfileResponse.ts
import BigDecimal from 'js-big-decimal'; // Giữ lại nếu dùng

// Import các Enum nếu cần (ví dụ VerificationStatus)
import { VerificationStatus } from '../../../../common/model/verification-status.enum'; // Đường dẫn có thể khác

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

  // --- CÁC TRƯỜNG TỪ USER PHẢI CÓ Ở ĐÂY ---
  fullName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  createdAt: string | null; // Ngày tham gia User
  // ---------------------------------------

  // updatedAt của profile (nếu cần)
  updatedAt?: string | null; // Thêm ? nếu có thể không có
}
