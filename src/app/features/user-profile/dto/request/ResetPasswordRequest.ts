// src/app/features/usermanagement/dto/request/ResetPasswordRequest.ts
export interface ResetPasswordRequest {
  token: string;
  newPassword?: string;
}
