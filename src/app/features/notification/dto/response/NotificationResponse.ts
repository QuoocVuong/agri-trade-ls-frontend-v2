// src/app/features/notification/dto/response/NotificationResponse.ts

// Import Enum nếu bạn đã tạo nó ở common/model
import { NotificationType } from '../../../../common/model/notification-type.enum';

export interface NotificationResponse {
  id: number; // Hoặc Long nếu backend dùng Long
  message: string;
  type: NotificationType | string; // Dùng Enum hoặc string
  isRead: boolean;
  readAt: string | null; // ISO date string hoặc null
  link: string | null;
  createdAt: string; // ISO date string
}
