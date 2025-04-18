// src/app/features/usermanagement/dto/request/UserRegistrationRequest.ts
// Thường không cần tạo class/interface riêng ở Frontend nếu dùng trực tiếp object literal
// Nhưng tạo interface giúp code rõ ràng và dễ quản lý hơn
export interface UserRegistrationRequest {
  email: string;
  password?: string; // Có thể optional nếu dùng cho mục đích khác
  fullName: string;
  phoneNumber?: string | null; // Cho phép null
  // Thêm roleType nếu dùng Cách 1 đăng ký
  // roleType?: 'CONSUMER' | 'FARMER' | 'BUSINESS_BUYER';
}
