import { Routes } from '@angular/router';

export const USER_PROFILE_ROUTES: Routes = [
  {
    path: '', // Route gốc của feature (ví dụ: /user/profile)
    pathMatch: 'full',
    loadComponent: () => import('./components/profile-view/profile-view.component').then(m => m.ProfileViewComponent),
    title: 'Thông tin tài khoản', // Set tiêu đề trang
    data: { breadcrumb: 'Thông tin tài khoản' }
  },
  {
    path: 'edit',
    loadComponent: () => import('./components/edit-profile/edit-profile.component').then(m => m.EditProfileComponent),
    title: 'Chỉnh sửa hồ sơ',
    data: { breadcrumb: 'Chỉnh sửa hồ sơ' }
  },
  {
    path: 'change-password',
    loadComponent: () => import('./components/change-password/change-password.component').then(m => m.ChangePasswordComponent),
    title: 'Đổi mật khẩu',
    data: { breadcrumb: 'Đổi mật khẩu' }
  },

  { // Route cho form đăng ký/sửa farmer profile
    path: 'farmer-profile',
    loadComponent: () => import('./components/edit-farmer-profile/edit-farmer-profile.component').then(m => m.EditFarmerProfileComponent),
    title: 'Hồ sơ Nông dân',
    data: { breadcrumb: 'Hồ sơ Nông dân' }
  },
  { // Route cho form đăng ký/sửa business profile
    path: 'business-profile',
    loadComponent: () => import('./components/edit-business-profile/edit-business-profile.component').then(m => m.EditBusinessProfileComponent),
    title: 'Hồ sơ Doanh nghiệp',
    data: { breadcrumb: 'Hồ sơ Doanh nghiệp' }
  },
  // Các route con khác nếu cần
];
