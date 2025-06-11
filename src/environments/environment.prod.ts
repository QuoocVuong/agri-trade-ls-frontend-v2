// src/environments/environment.prod.ts
export const environment = {
  production: true,
  // Sử dụng process.env để đọc biến môi trường do Vercel cung cấp
  apiUrl: process.env['NG_APP_API_URL'] || 'http://your-default-fallback-api.com/api',
  wsUrl: process.env['NG_APP_WS_URL'] || 'ws://your-default-fallback-api.com/ws',
};
