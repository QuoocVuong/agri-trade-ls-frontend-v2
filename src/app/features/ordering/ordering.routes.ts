import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard'; // Import authGuard

export const ORDERING_ROUTES: Routes = [
  {
    path: 'cart', // Route: /cart (đã định nghĩa ở app.routes.ts)
    loadComponent: () => import('./components/cart/cart.component').then(m => m.CartComponent),
    canActivate: [authGuard], // Yêu cầu đăng nhập để vào giỏ hàng
    title: 'Giỏ hàng'
  },
  {
    path: 'checkout', // Route: /checkout (đã định nghĩa ở app.routes.ts)
    loadComponent: () => import('./components/checkout/checkout.component').then(m => m.CheckoutComponent),
    canActivate: [authGuard], // Yêu cầu đăng nhập
    title: 'Thanh toán'
  },
  {
    path: 'history', // Route: /user/orders (đã định nghĩa ở app.routes.ts)
    loadComponent: () => import('./components/order-history/order-history.component').then(m => m.OrderHistoryComponent),
    canActivate: [authGuard],
    title: 'Lịch sử đơn hàng'
  },
  {
    path: ':id', // Route: /user/orders/:id (hoặc /orders/:id nếu dùng layout public)
    loadComponent: () => import('./components/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    canActivate: [authGuard],
    title: 'Chi tiết đơn hàng'
  },
  // Route mặc định cho ordering (nếu có) - ví dụ về history
  { path: '', redirectTo: 'history', pathMatch: 'full' }
];
