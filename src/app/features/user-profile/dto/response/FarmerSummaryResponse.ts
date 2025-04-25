// src/app/features/user-profile/dto/response/FarmerSummaryResponse.ts

/**
 * DTO chứa thông tin tóm tắt của Farmer để hiển thị trong danh sách (ví dụ: trang chủ, trang tìm kiếm farmer).
 */
export interface FarmerSummaryResponse {
  /** ID của User (Farmer) */
  userId: number;

  /** Tên trang trại/cửa hàng (lấy từ FarmerProfile) */
  farmName: string | null;

  /** Tên đầy đủ của User (lấy từ User) - dùng làm fallback nếu farmName null */
  fullName: string | null;

  /** URL ảnh đại diện (lấy từ User) */
  avatarUrl: string | null;

  /** Mã tỉnh (lấy từ FarmerProfile) - để hiển thị địa chỉ hoặc lọc */
  provinceCode: string | null;

  /** (Tùy chọn) Địa chỉ ngắn gọn đã được định dạng sẵn từ backend */
  // addressString?: string | null;

  /** (Tùy chọn) Rating trung bình của farmer */
  // averageRating?: number | null;

  /** (Tùy chọn) Slug của farmer nếu có trang profile dùng slug */
  // slug?: string | null;
}
