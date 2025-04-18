// src/app/features/usermanagement/dto/response/UserResponse.ts
export interface UserResponse {
  id: number; // Hoặc string nếu backend trả về string
  email: string;
  fullName: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  roles: string[]; // Danh sách tên role (vd: ["ROLE_CONSUMER", "ROLE_FARMER"])
  createdAt: string; // ISO date string
}
