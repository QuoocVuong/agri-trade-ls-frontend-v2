import { CartAdjustmentInfo } from './CartAdjustmentInfo'; // Import DTO vừa tạo

export interface CartValidationResponse {
  valid: boolean; // Giỏ hàng có hợp lệ để tiếp tục thanh toán không
  messages: string[];          // Danh sách các thông báo chung cho người dùng
  adjustments: CartAdjustmentInfo[] | null; // Danh sách chi tiết các điều chỉnh đã thực hiện (có thể null)
}
