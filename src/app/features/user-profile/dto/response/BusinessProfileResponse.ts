// src/app/features/usermanagement/dto/response/BusinessProfileResponse.ts
import {BusinessProfileRequest} from '../request/BusinessProfileRequest';

export interface BusinessProfileResponse {
  userId: number;
  businessName: string;
  taxCode: string | null;
  industry: string | null;
  businessPhone: string | null;
  businessAddressDetail: string | null;
  businessProvinceCode: string | null;
  districtCode: string | null;
  wardCode: string | null;
  contactPerson: string | null;
  companyName: string | null;
  address: BusinessProfileRequest | null;
  status : string | null;

  createdAt: string;
  updatedAt: string;
}
