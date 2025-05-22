// src/app/features/usermanagement/dto/response/LoginResponse.ts
import { UserResponse } from './UserResponse';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  user: UserResponse;
}
