// src/app/features/ordering/domain/supply-order-request-status.enum.ts
export enum SupplyOrderRequestStatus {
  PENDING_FARMER_ACTION = 'PENDING_FARMER_ACTION',
  FARMER_ACCEPTED = 'FARMER_ACCEPTED',
  FARMER_REJECTED = 'FARMER_REJECTED',
  BUYER_CANCELLED = 'BUYER_CANCELLED',
  NEGOTIATING = 'NEGOTIATING'
}

export function getSupplyOrderRequestStatusText(
  status: SupplyOrderRequestStatus | string | null | undefined,
  viewerIsFarmer: boolean = false // Thêm tham số để biết người xem có phải là Farmer không
): string {
  if (!status) return 'Không xác định';
  switch (status) {
    case SupplyOrderRequestStatus.PENDING_FARMER_ACTION:
      return viewerIsFarmer ? 'Chờ bạn xác nhận' : 'Chờ nhà cung cấp xác nhận';
    case SupplyOrderRequestStatus.FARMER_ACCEPTED:
      return viewerIsFarmer ? 'Bạn đã chấp nhận' : 'Nhà cung cấp đã chấp nhận';
    case SupplyOrderRequestStatus.FARMER_REJECTED:
      return viewerIsFarmer ? 'Bạn đã từ chối' : 'Nhà cung cấp đã từ chối';
    case SupplyOrderRequestStatus.BUYER_CANCELLED:
      return viewerIsFarmer ? 'Người mua đã hủy' : 'Bạn đã hủy'; // <<<< SỬA Ở ĐÂY
    case SupplyOrderRequestStatus.NEGOTIATING:
      return 'Đang thương lượng';
    default:
      return status.toString();
  }
}
export function getSupplyOrderRequestStatusCssClass(status: SupplyOrderRequestStatus | string | null | undefined): string {
  if (!status) return 'badge-ghost';
  switch (status) {
    case SupplyOrderRequestStatus.PENDING_FARMER_ACTION: return 'badge-warning dark:badge-warning'; // Vàng
    case SupplyOrderRequestStatus.FARMER_ACCEPTED: return 'badge-success dark:badge-success';     // Xanh lá
    case SupplyOrderRequestStatus.FARMER_REJECTED: return 'badge-error dark:badge-error';       // Đỏ
    case SupplyOrderRequestStatus.BUYER_CANCELLED: return 'badge-neutral dark:badge-neutral text-base-content/70 dark:text-gray-400'; // Xám
    case SupplyOrderRequestStatus.NEGOTIATING: return 'badge-info dark:badge-info';           // Xanh dương
    default: return 'badge-ghost';
  }
}
