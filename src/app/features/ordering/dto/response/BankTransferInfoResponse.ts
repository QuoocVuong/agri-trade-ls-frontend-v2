// src/app/features/ordering/dto/response/BankTransferInfoResponse.ts
import BigDecimal from "js-big-decimal";

export interface BankTransferInfoResponse {
  accountName: string;
  accountNumber: string;
  bankNameDisplay: string;
  amount: number | string | BigDecimal;
  orderCode: string;
  transferContent: string;
  qrCodeDataString: string | null; // URL đến ảnh QR
}
