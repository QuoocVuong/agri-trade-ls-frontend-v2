// src/app/features/catalog/dto/request/CategoryRequest.ts
export interface CategoryRequest {
  name: string;
  slug?: string | null; // Optional, backend có thể tự tạo
  description?: string | null;
  imageUrl?: string | null; // Signed URL preview
  blobPath?: string | null; // Path trên storage
  parentId?: number | null; // ID của danh mục cha
}
