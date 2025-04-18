import { Routes } from '@angular/router';

// Các route con bên trong /admin
export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard', // Path: /admin/dashboard
    loadComponent: () => import('./components/admin-stats/admin-stats.component').then(m => m.AdminStatsComponent),
    title: 'Admin - Bảng điều khiển'
  },
  {
    path: 'users', // Path: /admin/users
    loadComponent: () => import('./components/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
    title: 'Admin - Quản lý Người dùng'
  },
  {
    path: 'farmers/pending', // Path: /admin/farmers/pending
    loadComponent: () => import('./components/approve-farmers/approve-farmers.component').then(m => m.ApproveFarmersComponent),
    title: 'Admin - Duyệt Nông dân'
  },
  // { // Trang xem tất cả farmer
  //   path: 'farmers',
  //   loadComponent: () => import('./components/manage-farmers/manage-farmers.component').then(m => m.ManageFarmersComponent), // Tạo component này
  //   title: 'Admin - Quản lý Nông dân'
  // },
  {
    path: 'categories', // Path: /admin/categories
    loadComponent: () => import('./components/manage-categories/manage-categories.component').then(m => m.ManageCategoriesComponent),
    title: 'Admin - Quản lý Danh mục'
  },
  {
    path: 'products', // Path: /admin/products (Quản lý & Duyệt)
    loadComponent: () => import('./components/manage-all-products/manage-all-products.component').then(m => m.ManageAllProductsComponent),
    title: 'Admin - Quản lý Sản phẩm'
  },
  {
    path: 'orders', // Path: /admin/orders
    loadComponent: () => import('./components/manage-all-orders/manage-all-orders.component').then(m => m.ManageAllOrdersComponent),
    title: 'Admin - Quản lý Đơn hàng'
  },
  { // Route chi tiết đơn hàng cho Admin (có thể dùng chung component OrderDetail)
    path: 'orders/:id', // Path: /admin/orders/:id
    loadComponent: () => import('../ordering/components/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    data: { isAdminView: true }, // Truyền data để component biết là view của Admin
    title: 'Admin - Chi tiết Đơn hàng'
  },
  {
    path: 'reviews/pending', // Path: /admin/reviews/pending
    loadComponent: () => import('./components/approve-reviews/approve-reviews.component').then(m => m.ApproveReviewsComponent),
    title: 'Admin - Duyệt Đánh giá'
  },
  // { // Trang xem tất cả review
  //   path: 'reviews',
  //   loadComponent: () => import('./components/manage-all-reviews/manage-all-reviews.component').then(m => m.ManageAllReviewsComponent), // Tạo component này
  //   title: 'Admin - Quản lý Đánh giá'
  // },
  {
    path: 'roles', // Path: /admin/roles
    loadComponent: () => import('./components/manage-roles/manage-roles.component').then(m => m.ManageRolesComponent),
    title: 'Admin - Quản lý Phân quyền'
  },
  // Redirect mặc định của /admin về /admin/dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
