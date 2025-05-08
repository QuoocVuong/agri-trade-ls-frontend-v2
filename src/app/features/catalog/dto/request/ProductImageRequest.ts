// src/app/features/catalog/dto/request/ProductImageRequest.ts
export interface ProductImageRequest {
  id?: number | null; // Có thể có ID nếu là cập nhật ảnh đã có
  // imageUrl: string; // URL ảnh (sau khi upload)
  imageUrl?: string | null; // <<< BỎ HOẶC ĐỂ OPTIONAL
  blobPath?: string | null;
  isDefault?: boolean;
  displayOrder?: number;
}
