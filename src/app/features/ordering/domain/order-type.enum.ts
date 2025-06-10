// src/app/features/ordering/domain/order-type.enum.ts
export enum OrderType {
  B2C = 'B2C', // Business-to-Consumer (Bán lẻ)
  B2B = 'B2B'  // Business-to-Business (Bán sỉ)
}
export function getOrderTypeText(status: OrderType | string | null | undefined): string {
  if (!status) return 'N/A';
  switch (status) {
    case OrderType.B2C: return 'Bán lẻ (B2C)';
    case OrderType.B2B: return 'Bán sỉ (B2B)';
    default: return status;
  }
}
