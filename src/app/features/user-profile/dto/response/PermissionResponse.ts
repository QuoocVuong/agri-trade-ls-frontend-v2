// src/app/features/user-profile/dto/response/PermissionResponse.ts

/**
 * Đại diện cho thông tin của một Quyền hạn (Permission).
 */
export interface PermissionResponse {
  /** ID của quyền hạn */
  id: number;

  /** Tên định danh duy nhất của quyền hạn (ví dụ: USER_READ_ALL) */
  name: string;

  /** Mô tả chi tiết về quyền hạn (có thể null) */
  description: string | null;
}
