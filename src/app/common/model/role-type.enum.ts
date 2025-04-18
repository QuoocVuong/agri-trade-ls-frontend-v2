// src/app/common/model/role-type.enum.ts
export enum RoleType {
  ADMIN = 'ROLE_ADMIN',
  FARMER = 'ROLE_FARMER',
  CONSUMER = 'ROLE_CONSUMER',
  BUSINESS_BUYER = 'ROLE_BUSINESS_BUYER'
}

// Optional: Hàm lấy text tiếng Việt thân thiện
export function getRoleTypeText(role: RoleType | string | undefined | null): string {
  switch (role) {
    case RoleType.ADMIN: return 'Quản trị viên';
    case RoleType.FARMER: return 'Nông dân';
    case RoleType.CONSUMER: return 'Người tiêu dùng';
    case RoleType.BUSINESS_BUYER: return 'Doanh nghiệp';
    default: return 'Không xác định';
  }
}
