// Khai báo để TypeScript không báo lỗi 'process'
declare var process: {
  env: {
    [key: string]: string | undefined;
  };
};

export const environment = {
  production: true,
  apiUrl: process.env['NG_APP_API_URL'],
  wsUrl: process.env['NG_APP_WS_URL'],
};
