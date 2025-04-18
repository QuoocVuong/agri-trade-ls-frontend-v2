export interface ReviewRequest {
  productId: number;
  orderId?: number | null; // Optional
  rating: number; // 1-5
  comment?: string | null;
}
