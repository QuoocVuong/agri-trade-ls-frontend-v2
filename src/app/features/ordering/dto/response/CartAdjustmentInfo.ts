export interface CartAdjustmentInfo {
  productId: number | null; // ID của sản phẩm bị điều chỉnh (có thể null nếu sản phẩm không xác định)
  productName: string;    // Tên sản phẩm để hiển thị trong thông báo
  message: string;        // Thông báo chi tiết về việc điều chỉnh
  type: 'ADJUSTED' | 'REMOVED' | string; // Loại điều chỉnh: số lượng thay đổi hoặc item bị xóa
}
