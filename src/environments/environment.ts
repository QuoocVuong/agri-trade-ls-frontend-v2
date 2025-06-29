// src/environments/environment.ts
export const environment = {
  production: false,
  // apiUrl: 'http://localhost:8080/api', // URL gốc của Backend API khi chạy local
  // wsUrl: 'ws://localhost:8080/ws',// *** Thêm dòng này: URL WebSocket khi chạy local ***
  // ws:// cho kết nối thường, wss:// cho kết nối bảo mật (wss)
  // /ws là endpoint đã cấu hình trong WebSocketConfig của backend
  apiUrl: 'https://agritrade-backend.duckdns.org/api',
  wsUrl: 'wss://agritrade-backend.duckdns.org/ws',

  appBankAccountName: 'CONG TY TNHH AGRI TRADE',
  appBankAccountNumber: '0123456789',
  appBankName: 'VIETCOMBANK - CN LANG SON',
  appBankBranch: '', // Có thể gộp vào tên ngân hàng
  appBankQrCodeUrl: 'https://img.vietqr.io/image/VCB-0123456789-compact.png?accountName=CONG%20TY%20TNHH%20AGRI%20TRADELS' // Đường dẫn đến ảnh QR
};
