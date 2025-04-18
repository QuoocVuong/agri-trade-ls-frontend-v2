export interface AddressRequest {
  fullName: string;
  phoneNumber: string;
  addressDetail: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  type?: 'SHIPPING' | 'BILLING' | 'OTHER';
  isDefault?: boolean;
}
