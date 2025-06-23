// src/app/features/catalog/domain/product-status.enum.ts
export enum ProductStatus {
  DRAFT = 'DRAFT',             // Bản nháp, chỉ farmer thấy
  PENDING_APPROVAL = 'PENDING_APPROVAL', // Chờ Admin duyệt
  PUBLISHED = 'PUBLISHED',         // Đã duyệt, hiển thị công khai
  UNPUBLISHED = 'UNPUBLISHED',       // Farmer tạm ẩn
  REJECTED = 'REJECTED'            // Bị Admin từ chối
}

// Optional: Hàm lấy text tiếng Việt
export function getProductStatusText(status: ProductStatus | string | undefined | null): string {
  switch (status) {
    case ProductStatus.DRAFT: return 'Bản nháp';
    case ProductStatus.PENDING_APPROVAL: return 'Gửi duyệt';
    case ProductStatus.PUBLISHED: return 'Đang bán';
    case ProductStatus.UNPUBLISHED: return 'Tạm ẩn';
    case ProductStatus.REJECTED: return 'Bị từ chối';
    default: return 'Không xác định';
  }
}

// *** Hàm lấy class CSS tương ứng  ***
export function getProductStatusCssClass(status: ProductStatus | string | undefined | null): string {
  switch (status) {
    case ProductStatus.DRAFT: return 'badge-ghost'; // Màu xám nhạt
    case ProductStatus.PENDING_APPROVAL: return 'badge-warning'; // Màu vàng
    case ProductStatus.PUBLISHED: return 'badge-success'; // Màu xanh lá
    case ProductStatus.UNPUBLISHED: return 'badge-neutral'; // Màu trung tính/xám đậm hơn
    case ProductStatus.REJECTED: return 'badge-error'; // Màu đỏ
    default: return 'badge-ghost'; // Mặc định
  }
}
