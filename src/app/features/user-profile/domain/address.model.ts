// Thường giống hệt Address model, có thể dùng lại model hoặc tạo riêng để tách biệt
export interface Address {
  id: number;
  userId: number;
  fullName: string;
  phoneNumber: string;
  addressDetail: string;
  provinceCode: string;
  districtCode: string;
  wardCode: string;
  type: 'SHIPPING' | 'BILLING' | 'OTHER';
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
