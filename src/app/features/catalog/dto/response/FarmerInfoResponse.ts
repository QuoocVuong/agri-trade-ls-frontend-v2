// src/app/features/catalog/dto/response/FarmerInfoResponse.ts
// DTO đơn giản để nhúng vào Product responses
export interface FarmerInfoResponse {
  farmerId: number; // userId của farmer
  farmName: string | null; // Lấy từ FarmerProfile
  fullName: string | null;
  farmerName?: string; // Tên của farmer (tùy chọn, lấy từ User)
  farmerAvatarUrl: string | null; // Lấy từ User
  provinceCode: string | null; // Lấy từ FarmerProfile
  // Có thể thêm rating trung bình của farmer nếu cần
  // averageRating?: number;
}
