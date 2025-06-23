// src/app/features/usermanagement/dto/request/UserRegistrationRequest.ts
// Thường không cần tạo class/interface riêng ở Frontend nếu dùng trực tiếp object literal
// Nhưng tạo interface giúp code rõ ràng và dễ quản lý hơn
export interface UserRegistrationRequest {
  email: string;
  password?: string;
  fullName: string;
  phoneNumber?: string | null; // Cho phép null

}
