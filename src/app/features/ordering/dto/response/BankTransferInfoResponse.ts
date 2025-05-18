// src/app/features/ordering/dto/response/BankTransferInfoResponse.ts
import BigDecimal from "js-big-decimal"; // Hoặc dùng number/string nếu backend trả về vậy

export interface BankTransferInfoResponse {
  accountName: string;
  accountNumber: string;
  bankNameDisplay: string;
  amount: number | string | BigDecimal; // Backend trả về BigDecimal, frontend có thể nhận là string/number
  orderCode: string;
  transferContent: string;
  qrCodeDataString: string | null; // URL đến ảnh QR
}
