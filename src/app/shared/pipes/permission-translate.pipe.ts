import { Pipe, PipeTransform } from '@angular/core';

// Định nghĩa kiểu cho bản đồ dịch
type PermissionTranslationMap = {
  [key: string]: string;
};

@Pipe({
  name: 'permissionTranslate',
  standalone: true,
})
export class PermissionTranslatePipe implements PipeTransform {

  // Định nghĩa bản đồ ánh xạ tên quyền Anh -> Việt
  private readonly permissionMap: PermissionTranslationMap = {
    // == User Management ==
    USER_READ_ALL: 'Xem tất cả người dùng',
    USER_READ_DETAIL: 'Xem chi tiết người dùng',
    USER_UPDATE_STATUS: 'Cập nhật trạng thái người dùng',
    USER_UPDATE_ROLES: 'Cập nhật vai trò người dùng',
    USER_MANAGE_PROFILES: 'Quản lý hồ sơ người dùng', // Ví dụ chung
    // == Role & Permission Management ==
    ROLE_READ_ALL: 'Xem tất cả vai trò',
    ROLE_UPDATE_PERMISSIONS: 'Cập nhật quyền cho vai trò',
    PERMISSION_READ_ALL: 'Xem tất cả quyền hạn',
    PERMISSION_MANAGE: 'Quản lý quyền hạn (Thêm/Sửa/Xóa)', // Ví dụ quyền tổng quát
    // == Product Management ==
    PRODUCT_CREATE: 'Tạo sản phẩm',
    PRODUCT_READ: 'Xem sản phẩm (Public)', // Xem sp công khai
    PRODUCT_READ_OWN: 'Xem sản phẩm của tôi', // Farmer xem sp của mình
    PRODUCT_UPDATE_OWN: 'Cập nhật sản phẩm của tôi',
    PRODUCT_DELETE_OWN: 'Xóa sản phẩm của tôi',
    PRODUCT_MANAGE_ALL: 'Quản lý tất cả sản phẩm (Admin)', // Admin duyệt/sửa/xóa mọi sp
    PRODUCT_MANAGE_OWN: 'Quản lý sản phẩm của tôi',
    // == Order Management ==
    ORDER_CREATE: 'Tạo đơn hàng',
    ORDER_READ_OWN: 'Xem đơn hàng của tôi', // Buyer/Farmer xem đơn của mình
    ORDER_READ_ALL: 'Xem tất cả đơn hàng (Admin)',
    ORDER_UPDATE_STATUS_OWN: 'Cập nhật trạng thái đơn hàng của tôi', // Farmer cập nhật trạng thái
    ORDER_UPDATE_STATUS_ALL: 'Cập nhật trạng thái mọi đơn hàng (Admin)',
    // == Farmer Profile Approval ==
    FARMER_PROFILE_APPROVE: 'Duyệt hồ sơ nông dân',
    // == Interaction (Chat, Review) ==
    REVIEW_MANAGE: 'Quản lý đánh giá (Admin)', // Duyệt/Xóa review
    CHAT_ACCESS: 'Truy cập Chat',
    // == Add more as needed ==
    // Ví dụ:
    // CATEGORY_MANAGE: 'Quản lý danh mục',
    // PAYMENT_MANAGE: 'Quản lý thanh toán',
  };

  transform(permissionName: string | null | undefined): string {
    if (!permissionName) {
      return 'N/A'; // Hoặc chuỗi trống
    }
    // Trả về bản dịch nếu tìm thấy, ngược lại trả về tên gốc
    return this.permissionMap[permissionName] || permissionName;
  }
}
