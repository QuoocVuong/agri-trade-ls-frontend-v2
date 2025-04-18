// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api', // URL gốc của Backend API khi chạy local
  wsUrl: 'ws://localhost:8080/ws'// *** Thêm dòng này: URL WebSocket khi chạy local ***
  // ws:// cho kết nối thường, wss:// cho kết nối bảo mật (wss)
  // /ws là endpoint đã cấu hình trong WebSocketConfig của backend
};
