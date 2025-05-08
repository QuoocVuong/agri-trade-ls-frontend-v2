// src/app/features/catalog/dto/response/ProductImageResponse.ts
export interface ProductImageResponse {
  id: number;
  imageUrl: string;
  blobPath?: string | null; // <<< NÊN CÓ: Key trên Firebase, để khi sửa sản phẩm biết path nào cần xóa
  isDefault: boolean;
  displayOrder: number;
  createdAt: string; // ISO date string
}
