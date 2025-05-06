// src/app/core/models/auth-response.model.ts

// Interface này định nghĩa cấu trúc dữ liệu mà API login và API verify Google trả về
export interface AuthResponse {
  accessToken: string; // JWT token
  tokenType?: string; // Thường là 'Bearer' (optional ở frontend nếu không dùng)
  // Thêm các trường khác nếu backend trả về (ví dụ: expiresIn, refreshToken, user info)
  // expiresIn?: number;
  // refreshToken?: string;
  // user?: UserResponse; // Có thể có hoặc không tùy vào API login/verify
}

// Có thể bạn đã có LoginResponse, nếu cấu trúc giống hệt AuthResponse thì dùng chung 1 interface là đủ.
// Nếu LoginResponse có thêm trường 'user' mà verify Google không có, thì cần 2 interface riêng.
// Ví dụ:
// import { UserResponse } from '../../features/user-profile/dto/response/UserResponse';
// export interface LoginResponse extends AuthResponse {
//   user: UserResponse;
// }
