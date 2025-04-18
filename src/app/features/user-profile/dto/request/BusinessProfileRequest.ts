// src/app/features/usermanagement/dto/request/BusinessProfileRequest.ts
export interface BusinessProfileRequest {
  businessName: string;
  taxCode?: string | null;
  industry?: string | null;
  businessPhone?: string | null;
  businessAddressDetail?: string | null;
  businessProvinceCode: string;
  businessDistrictCode?: string | null;
  businessWardCode?: string | null;
  contactPerson?: string | null;
}
