import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent),
    title: 'Đăng nhập'
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent),
    title: 'Đăng ký'
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./components/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent),
    title: 'Quên mật khẩu'
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Đặt lại mật khẩu'
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./components/verify-email/verify-email.component').then(m => m.VerifyEmailComponent),
    title: 'Xác thực Email'
  },
  { // Redirect mặc định của /auth về /auth/login
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
