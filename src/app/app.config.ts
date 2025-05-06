import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http'; // Import provideHttpClient và withInterceptors
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import {provideToastr} from 'ngx-toastr';
import {provideCharts, withDefaultRegisterables} from 'ng2-charts';
import {GoogleLoginProvider, SocialAuthServiceConfig} from '@abacritt/angularx-social-login'; // Sẽ tạo interceptor

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
    // ****** THÊM CẤU HÌNH SOCIAL LOGIN ******
    provideCharts(withDefaultRegisterables()),

      {
        provide: 'SocialAuthServiceConfig',
        useValue: {
          autoLogin: false, // Không tự động login khi load trang
          providers: [
            {
              id: GoogleLoginProvider.PROVIDER_ID,
              provider: new GoogleLoginProvider(
                '1078646222149-c5k0i6kq80cm24ttoq2rjt4er44ao1if.apps.googleusercontent.com' // <<< THAY BẰNG CLIENT ID CỦA BẠN
                // Thêm các tùy chọn khác nếu cần
                // {
                //   oneTapEnabled: false, // Tắt One Tap nếu muốn dùng nút bấm truyền thống
                //   scopes: 'openid profile email'
                // }
              )
            },
            // Thêm các provider khác (Facebook, etc.) ở đây nếu muốn
          ],
          onError: (err) => {
            console.error("Social Login Error:", err);
          }
        } as SocialAuthServiceConfig,
      },
    importProvidersFrom([]),

    // *************************************

  ]
};
