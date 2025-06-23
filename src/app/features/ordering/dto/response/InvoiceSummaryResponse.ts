


import {InvoiceStatus} from '../../domain/invoice-status.enum';

export interface InvoiceSummaryResponse {
  invoiceId: number;
  invoiceNumber: string;
  orderId: number;
  orderCode: string;
  buyerFullName: string;
  totalAmount: number;
  issueDate: string; // Hoặc Date
  dueDate: string | null; // Hoặc Date | null
  status: InvoiceStatus;
  createdAt: string; // Hoặc Date
}
