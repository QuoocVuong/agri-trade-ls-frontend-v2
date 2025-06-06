// src/app/features/user-profile/dto/response/UserInfoSimpleResponse.ts

/**
 * Interface chứa thông tin rất cơ bản về người dùng,
 * thường dùng để nhúng vào các response khác (ví dụ: người gửi tin nhắn, người đánh giá).
 */
export interface UserInfoSimpleResponse {
  /** ID của người dùng */
  id: number; // Hoặc string nếu backend trả về string

  /** Họ và tên đầy đủ */
  fullName: string;

  /** URL ảnh đại diện (có thể null) */
  avatarUrl: string | null;

  Online?: boolean;


}
