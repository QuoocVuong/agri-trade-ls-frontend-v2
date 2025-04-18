// src/app/features/ordering/dto/request/OrderStatusUpdateRequest.ts
import { OrderStatus } from '../../domain/order-status.enum'; // Import Enum

export interface OrderStatusUpdateRequest {
  status: OrderStatus; // Trạng thái mới muốn cập nhật
  notes?: string | null; // Ghi chú của người cập nhật (Admin/Farmer)
}
