export interface AgreedOrderItemRequest {
  productId: number; // ID sản phẩm gốc để tham chiếu
  productName: string;
  unit: string;
  quantity: number;
  pricePerUnit: number | string; // Cho phép string để dễ nhập, sẽ convert sau
}
