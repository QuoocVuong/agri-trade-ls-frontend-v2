// src/app/features/catalog/dto/response/ProductImageResponse.ts
export interface ProductImageResponse {
  id: number;
  imageUrl: string; // Sẽ là Signed URL mới được tạo động bởi Backend
  blobPath: string; // <<<< QUAN TRỌNG: Nhận blobPath từ Backend
  isDefault: boolean;
  displayOrder: number;
  createdAt: string; // ISO date string
}
