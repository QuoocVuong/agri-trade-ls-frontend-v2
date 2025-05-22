// src/app/features/ordering/domain/invoice-status.enum.ts (hoặc một vị trí chung hơn)
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  VOID = 'VOID',
  OVERDUE = 'OVERDUE'
}
