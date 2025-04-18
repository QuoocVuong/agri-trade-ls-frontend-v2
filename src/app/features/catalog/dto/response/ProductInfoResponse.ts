// src/app/features/catalog/dto/response/ProductInfoResponse.ts
// DTO rất cơ bản để nhúng vào OrderItemResponse chẳng hạn
export interface ProductInfoResponse {
  id: number;
  name: string;
  slug: string;
  thumbnailUrl: string | null; // Ảnh đại diện
}
