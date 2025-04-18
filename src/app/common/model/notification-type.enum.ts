// src/app/common/model/notification-type.enum.ts

export enum NotificationType {
  // --- Order Related ---
  /** Đơn hàng mới được đặt (gửi cho Buyer & Farmer) */
  ORDER_PLACED = 'ORDER_PLACED',
  /** Trạng thái đơn hàng được cập nhật (gửi cho Buyer, có thể cả Farmer) */
  ORDER_STATUS_UPDATE = 'ORDER_STATUS_UPDATE',
  /** Đơn hàng bị hủy (gửi cho Buyer & Farmer) */
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // --- Payment Related ---
  /** Thanh toán thành công (gửi cho Buyer, có thể cả Farmer) */
  PAYMENT_SUCCESS = 'PAYMENT_SUCCESS',
  /** Thanh toán thất bại (gửi cho Buyer) */
  PAYMENT_FAILURE = 'PAYMENT_FAILURE',

  // --- Chat Related ---
  /** Có tin nhắn mới (gửi cho Recipient) */
  NEW_MESSAGE = 'NEW_MESSAGE',

  // --- Follow Related ---
  /** Có người mới theo dõi (gửi cho Followed User) */
  NEW_FOLLOWER = 'NEW_FOLLOWER',

  // --- Product Related (Admin Actions) ---
  /** Sản phẩm được Admin duyệt (gửi cho Farmer) */
  PRODUCT_APPROVED = 'PRODUCT_APPROVED',
  /** Sản phẩm bị Admin từ chối (gửi cho Farmer) */
  PRODUCT_REJECTED = 'PRODUCT_REJECTED',
  // Có thể thêm PRODUCT_PENDING_APPROVAL nếu cần thông báo cho Admin

  // --- Review Related ---
  /** Đánh giá đang chờ duyệt (có thể gửi cho Admin) */
  REVIEW_PENDING = 'REVIEW_PENDING', // Thêm mới
  /** Đánh giá được Admin duyệt (gửi cho Consumer) */
  REVIEW_APPROVED = 'REVIEW_APPROVED',
  /** Đánh giá bị Admin từ chối (gửi cho Consumer) */
  REVIEW_REJECTED = 'REVIEW_REJECTED',

  // --- User/Account Related ---
  /** Chào mừng user mới (sau khi xác thực email) */
  WELCOME = 'WELCOME',
  /** Thông báo đổi mật khẩu thành công */
  PASSWORD_RESET_SUCCESS = 'PASSWORD_RESET_SUCCESS', // Đổi tên từ PASSWORD_RESET cho rõ hơn
  /** Thông báo email đã được xác thực */
  EMAIL_VERIFIED = 'EMAIL_VERIFIED', // Có thể gộp với WELCOME
  /** Thông báo tài khoản bị cập nhật trạng thái (active/inactive) */
  ACCOUNT_STATUS_UPDATE = 'ACCOUNT_STATUS_UPDATE', // Thêm mới
  /** Thông báo vai trò tài khoản bị thay đổi */
  ROLES_UPDATED = 'ROLES_UPDATED', // Thêm mới
  /** Hồ sơ Farmer được duyệt */
  FARMER_PROFILE_APPROVED = 'FARMER_PROFILE_APPROVED', // Thêm mới
  /** Hồ sơ Farmer bị từ chối */
  FARMER_PROFILE_REJECTED = 'FARMER_PROFILE_REJECTED', // Thêm mới
  // Có thể thêm cho Business Profile tương tự

  // --- System/Admin Related ---
  /** Thông báo chung từ hệ thống/Admin */
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
  /** Thông báo về chương trình khuyến mãi mới */
  PROMOTION = 'PROMOTION',
  /** Loại thông báo khác / Chưa phân loại */
  OTHER = 'OTHER'
}

// Optional: Hàm lấy text mô tả ngắn gọn cho từng loại (dùng trong UI nếu cần)
export function getNotificationTypeText(type: NotificationType | string | undefined | null): string {
  switch (type) {
    case NotificationType.ORDER_PLACED: return 'Đơn hàng mới';
    case NotificationType.ORDER_STATUS_UPDATE: return 'Cập nhật đơn hàng';
    case NotificationType.ORDER_CANCELLED: return 'Đơn hàng đã hủy';
    case NotificationType.PAYMENT_SUCCESS: return 'Thanh toán thành công';
    case NotificationType.PAYMENT_FAILURE: return 'Thanh toán thất bại';
    case NotificationType.NEW_MESSAGE: return 'Tin nhắn mới';
    case NotificationType.NEW_FOLLOWER: return 'Có người theo dõi mới';
    case NotificationType.PRODUCT_APPROVED: return 'Sản phẩm được duyệt';
    case NotificationType.PRODUCT_REJECTED: return 'Sản phẩm bị từ chối';
    case NotificationType.REVIEW_PENDING: return 'Đánh giá chờ duyệt';
    case NotificationType.REVIEW_APPROVED: return 'Đánh giá được duyệt';
    case NotificationType.REVIEW_REJECTED: return 'Đánh giá bị từ chối';
    case NotificationType.WELCOME: return 'Chào mừng thành viên mới';
    case NotificationType.PASSWORD_RESET_SUCCESS: return 'Cập nhật mật khẩu';
    case NotificationType.EMAIL_VERIFIED: return 'Xác thực Email';
    case NotificationType.ACCOUNT_STATUS_UPDATE: return 'Cập nhật tài khoản';
    case NotificationType.ROLES_UPDATED: return 'Cập nhật vai trò';
    case NotificationType.FARMER_PROFILE_APPROVED: return 'Hồ sơ nông dân được duyệt';
    case NotificationType.FARMER_PROFILE_REJECTED: return 'Hồ sơ nông dân bị từ chối';
    case NotificationType.SYSTEM_ANNOUNCEMENT: return 'Thông báo hệ thống';
    case NotificationType.PROMOTION: return 'Khuyến mãi';
    case NotificationType.OTHER: return 'Thông báo khác';
    default: return 'Thông báo';
  }
}

// Optional: Hàm lấy icon tương ứng (ví dụ tên class icon của FontAwesome hoặc Material Icons)
export function getNotificationTypeIcon(type: NotificationType | string | undefined | null): string {
  switch (type) {
    case NotificationType.ORDER_PLACED: return 'fas fa-receipt'; // Ví dụ FontAwesome
    case NotificationType.ORDER_STATUS_UPDATE: return 'fas fa-truck-fast';
    case NotificationType.ORDER_CANCELLED: return 'fas fa-ban';
    case NotificationType.PAYMENT_SUCCESS: return 'fas fa-check-circle';
    case NotificationType.PAYMENT_FAILURE: return 'fas fa-times-circle';
    case NotificationType.NEW_MESSAGE: return 'fas fa-comment-dots';
    case NotificationType.NEW_FOLLOWER: return 'fas fa-user-plus';
    case NotificationType.PRODUCT_APPROVED: return 'fas fa-carrot'; // Ví dụ
    case NotificationType.PRODUCT_REJECTED: return 'fas fa-times';
    case NotificationType.REVIEW_PENDING: return 'fas fa-hourglass-half';
    case NotificationType.REVIEW_APPROVED: return 'fas fa-star';
    case NotificationType.REVIEW_REJECTED: return 'fas fa-comment-slash';
    case NotificationType.WELCOME: return 'fas fa-handshake';
    // ... thêm icon cho các loại khác ...
    default: return 'fas fa-info-circle';
  }
}
