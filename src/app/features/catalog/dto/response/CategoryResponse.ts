// src/app/features/catalog/dto/response/CategoryResponse.ts
//import { CategoryInfoResponse } from '../response/CategoryInfoResponse'; // Import để dùng cho children

export interface CategoryResponse {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  parentId: number | null;
  children?: CategoryResponse[] | null; // Cho cấu trúc cây
  createdAt: string; // ISO date string
  updatedAt: string;
}
