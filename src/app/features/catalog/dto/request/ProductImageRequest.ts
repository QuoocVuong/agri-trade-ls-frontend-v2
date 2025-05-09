// src/app/features/catalog/dto/request/ProductImageRequest.ts
export interface ProductImageRequest {
  id?: number | null; // Có thể có ID nếu là cập nhật ảnh đã có
  imageUrl: string; // Signed URL từ upload, hoặc URL cũ khi edit
  blobPath: string; // Key trên Firebase
  isDefault?: boolean;
  displayOrder?: number;
}
