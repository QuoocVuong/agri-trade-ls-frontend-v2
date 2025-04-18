import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

// Các route cho module interaction (ví dụ: /chat, /my-reviews...)
// Chúng có thể được lồng vào các layout khác nhau (UserDashboard, Public...)
// Hoặc có layout riêng nếu cần.
export const INTERACTION_ROUTES: Routes = [
  {
    path: 'chat', // Ví dụ: /chat (cần được import vào app.routes.ts và đặt trong layout phù hợp)
    loadComponent: () => import('./components/chat/chat-layout/chat-layout.component').then(m => m.ChatLayoutComponent),
    canActivate: [authGuard], // Chat yêu cầu đăng nhập
    title: 'Tin nhắn'
  },
  {
    path: 'my-reviews', // Ví dụ: /user/my-reviews (cần import vào user profile routes)
    loadComponent: () => import('./components/review-list/review-list.component').then(m => m.ReviewListComponent),
    data: { mode: 'my' }, // Truyền dữ liệu để component biết cần load review của tôi
    canActivate: [authGuard],
    title: 'Đánh giá của tôi'
  },
  // Route xem danh sách người theo dõi/đang theo dõi có thể đặt trong user-profile
  // Route xem danh sách yêu thích cũng có thể đặt trong user-profile
];

// Bạn cần import routes này vào nơi phù hợp trong app.routes.ts
// Ví dụ:
/*
// trong app.routes.ts
{
  path: '', // Layout public hoặc user dashboard
  component: UserDashboardLayoutComponent, // Ví dụ
  canActivate: [authGuard],
  children: [
    // ... các route khác
    { path: 'chat', loadChildren: () => import('./features/interaction/interaction.routes').then(m => m.INTERACTION_ROUTES) },
    // ...
  ]
},
// Hoặc lồng vào user profile routes
{
  path: 'user',
  // ...
  children: [
    // ... profile routes
    { path: 'my-reviews', loadComponent: () => import('./features/interaction/components/review-list/review-list.component').then(m => m.ReviewListComponent), data: { mode: 'my' } },
    // ...
  ]
}
*/
