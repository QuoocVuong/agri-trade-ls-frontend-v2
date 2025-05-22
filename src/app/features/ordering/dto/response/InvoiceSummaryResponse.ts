// src/app/features/admin-dashboard/dto/response/invoice-summary.response.ts (hoặc nơi bạn đặt DTO cho admin)


import {InvoiceStatus} from '../../domain/invoice-status.enum';

export interface InvoiceSummaryResponse {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderCode: string;
  buyerFullName: string;
  totalAmount: number; // Hoặc string nếu bạn muốn format ở backend
  issueDate: string; // Hoặc Date
  dueDate: string | null; // Hoặc Date | null
  status: InvoiceStatus;
  createdAt: string; // Hoặc Date
}
