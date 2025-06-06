// src/app/features/ordering/domain/supply-order-request-status.enum.ts
export enum SupplyOrderRequestStatus {
  PENDING_FARMER_ACTION = 'PENDING_FARMER_ACTION',
  FARMER_ACCEPTED = 'FARMER_ACCEPTED',
  FARMER_REJECTED = 'FARMER_REJECTED',
  BUYER_CANCELLED = 'BUYER_CANCELLED',
  NEGOTIATING = 'NEGOTIATING'
}

export function getSupplyOrderRequestStatusText(status: SupplyOrderRequestStatus | string | undefined | null): string {
  if (!status) return 'Không rõ';
  switch (status) {
    case SupplyOrderRequestStatus.PENDING_FARMER_ACTION: return 'Chờ nhà cung cấp xác nhận';
    case SupplyOrderRequestStatus.FARMER_ACCEPTED: return 'Nhà cung cấp đã chấp nhận';
    case SupplyOrderRequestStatus.FARMER_REJECTED: return 'Nhà cung cấp đã từ chối';
    case SupplyOrderRequestStatus.BUYER_CANCELLED: return 'Bạn đã hủy yêu cầu';
    case SupplyOrderRequestStatus.NEGOTIATING: return 'Đang thương lượng';
    default: return status.toString();
  }
}
// Thêm hàm getCssClass nếu cần
