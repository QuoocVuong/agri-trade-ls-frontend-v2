// src/app/features/usermanagement/dto/response/BusinessProfileResponse.ts
export interface BusinessProfileResponse {
  userId: number;
  businessName: string;
  taxCode: string | null;
  industry: string | null;
  businessPhone: string | null;
  businessAddressDetail: string | null;
  businessProvinceCode: string | null;
  districtCode: string | null; // Đã sửa tên ở backend mapper
  wardCode: string | null;     // Đã sửa tên ở backend mapper
  contactPerson: string | null;
  createdAt: string;
  updatedAt: string;
}
