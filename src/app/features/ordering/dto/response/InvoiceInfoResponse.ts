// src/app/features/ordering/dto/response/InvoiceInfoResponse.ts (hoặc một đường dẫn tương tự)


import {InvoiceStatus} from '../../domain/invoice-status.enum';

export interface InvoiceInfoResponse {
  invoiceNumber: string;
  issueDate: string; // Hoặc Date, tùy cách bạn xử lý ngày tháng
  dueDate: string | null; // Hoặc Date | null
  status: InvoiceStatus;
  invoiceId?: number;

}
