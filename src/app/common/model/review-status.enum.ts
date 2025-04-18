// src/app/common/model/review-status.enum.ts

export enum ReviewStatus {
  PENDING = 'PENDING',     // Chờ duyệt
  APPROVED = 'APPROVED',   // Đã duyệt
  REJECTED = 'REJECTED'    // Bị từ chối
}

// Optional: Hàm lấy text tiếng Việt
export function getReviewStatusText(status: ReviewStatus | string | undefined | null): string {
  switch (status) {
    case ReviewStatus.PENDING: return 'Chờ duyệt';
    case ReviewStatus.APPROVED: return 'Đã duyệt';
    case ReviewStatus.REJECTED: return 'Bị từ chối';
    default: return 'Không xác định';
  }
}

// Optional: Hàm lấy màu sắc tương ứng (ví dụ cho badge DaisyUI)
export function getReviewStatusCssClass(status: ReviewStatus | string | undefined | null): string {
  switch (status) {
    case ReviewStatus.PENDING: return 'badge-warning';
    case ReviewStatus.APPROVED: return 'badge-success';
    case ReviewStatus.REJECTED: return 'badge-error';
    default: return 'badge-ghost';
  }
}
