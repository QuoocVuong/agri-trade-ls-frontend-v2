// src/app/features/ordering/dto/response/PaymentResponse.ts
import { PaymentTransactionStatus } from '../../domain/payment-transaction-status.enum'; // Import Enum
import  BigDecimal from 'js-big-decimal'; // Hoặc dùng number/string

export interface PaymentResponse {
  id: number;
  transactionCode: string | null;
  paymentGateway: string; // Tên cổng thanh toán (COD, VNPAY...)
  amount: number | string | BigDecimal;
  status: PaymentTransactionStatus;
  paymentTime: string | null; // ISO date string
  gatewayMessage: string | null;
  createdAt: string;
}
