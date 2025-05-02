import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // Import provideHttpClient và withInterceptors
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import {provideToastr} from 'ngx-toastr';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts'; // Sẽ tạo interceptor

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes,
      withComponentInputBinding(), // Cho phép binding route params vào component inputs
      withViewTransitions() // Bật hiệu ứng chuyển trang cơ bản
    ),
    provideHttpClient(withInterceptors([authInterceptor])), // Cung cấp HttpClient và đăng ký Interceptor
    provideAnimationsAsync(), // Cần cho Angular Material hoặc các thư viện UI khác nếu dùng animation
    // Thêm các providers khác ở đây nếu cần (ví dụ: cho state management)
    provideToastr({
      timeOut: 5000, // Thời gian hiển thị (ms)
      positionClass: 'toast-top-right', // Vị trí hiển thị
      preventDuplicates: true, // Ngăn hiển thị thông báo trùng lặp
      progressBar: true, // Hiển thị thanh tiến trình
      closeButton: true, // Hiển thị nút đóng
      // Các tùy chọn khác: https://github.com/scttcper/ngx-toastr#options
    }),
    // Thêm các providers khác ở đây nếu cần
    provideCharts(withDefaultRegisterables()),
  ]
};
