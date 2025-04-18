// src/app/features/ordering/dto/request/CartItemRequest.ts
export interface CartItemRequest {
  productId: number; // ID của sản phẩm cần thêm/cập nhật
  quantity: number;  // Số lượng muốn thêm hoặc số lượng mới
}
