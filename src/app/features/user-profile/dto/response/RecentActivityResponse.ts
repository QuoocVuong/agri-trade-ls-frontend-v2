// src/app/features/user-profile/dto/response/RecentActivityResponse.ts
import { NotificationType } from '../../../../common/model/notification-type.enum'; // Import NotificationType

/**
 * Đại diện cho một hoạt động gần đây trong hệ thống.
 */
export interface RecentActivityResponse {
  /** ID của đối tượng liên quan (Order, User, Review...) */
  id: number;

  /** Loại hoạt động (có thể dùng NotificationType hoặc tạo Enum riêng) */
  type: NotificationType | string; // Dùng string nếu có type tùy chỉnh khác

  /** Mô tả ngắn gọn về hoạt động */
  description: string;

  /** Thời gian xảy ra hoạt động (ISO date string) */
  timestamp: string;

  /** Link đến trang chi tiết liên quan (tùy chọn) */
  link?: string | null;

  /** (Tùy chọn) Thông tin người thực hiện hành động */
  actor?: {
    id: number;
    name: string;
    avatarUrl?: string | null;
  } | null;
}
