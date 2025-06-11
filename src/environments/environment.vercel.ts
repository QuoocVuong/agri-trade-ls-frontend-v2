// src/environments/environment.vercel.ts

export const environment = {
  production: true,
  // Các giá trị này sẽ được Vercel thay thế bằng biến môi trường
  apiUrl: '%NG_APP_API_URL%',
  wsUrl: '%NG_APP_WS_URL%',
};
