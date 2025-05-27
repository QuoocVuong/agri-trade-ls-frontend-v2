// src/app/features/ordering/domain/invoice-status.enum.ts (hoặc một vị trí chung hơn)
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  VOID = 'VOID',
  OVERDUE = 'OVERDUE'
}
export function getInvoiceStatusText(status: InvoiceStatus | string | undefined | null): string {
  if (!status) return 'Không xác định';
  switch (status) {
    case InvoiceStatus.DRAFT: return 'Nháp';
    case InvoiceStatus.ISSUED: return 'Đã phát hành';
    case InvoiceStatus.PAID: return 'Đã thanh toán';
    case InvoiceStatus.VOID: return 'Đã hủy';
    case InvoiceStatus.OVERDUE: return 'Quá hạn';
    default: return status.toString();
  }
}
