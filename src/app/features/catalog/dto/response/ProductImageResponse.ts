// src/app/features/catalog/dto/response/ProductImageResponse.ts
export interface ProductImageResponse {
  id: number;
  imageUrl: string;
  isDefault: boolean;
  displayOrder: number;
  createdAt: string; // ISO date string
}
