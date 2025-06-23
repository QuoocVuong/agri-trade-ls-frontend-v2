// src/app/core/models/auth-response.model.ts

// Interface này định nghĩa cấu trúc dữ liệu mà API login và API verify Google trả về
export interface AuthResponse {
  accessToken: string; // JWT token
  tokenType?: string; // Thường là 'Bearer'
}


