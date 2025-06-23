// src/app/features/notification/dto/response/NotificationResponse.ts


import { NotificationType } from '../../../../common/model/notification-type.enum';

export interface NotificationResponse {
  id: number;
  message: string;
  type: NotificationType | string; // Dùng Enum hoặc string
  isRead: boolean;
  readAt: string | null; // ISO date string hoặc null
  link: string | null;
  createdAt: string; // ISO date string
}
