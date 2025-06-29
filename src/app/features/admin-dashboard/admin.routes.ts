import { Routes } from '@angular/router';

// Các route con bên trong /admin
export const ADMIN_ROUTES: Routes = [
  {
    path: 'dashboard', // Path: /admin/dashboard
    loadComponent: () => import('./components/admin-stats/admin-stats.component').then(m => m.AdminStatsComponent),
    title: 'Admin - Bảng điều khiển',
    data: { breadcrumb: 'Bảng Điều Khiển' } // << THÊM
  },
  {
    path: 'users', // Path: /admin/users
    loadComponent: () => import('./components/manage-users/manage-users.component').then(m => m.ManageUsersComponent),
    title: 'Admin - Quản lý Người dùng',
    data: { breadcrumb: 'Quản Lý Người Dùng' } // << THÊM
  },
  {
    path: 'farmers/pending', // Path: /admin/farmers/pending
    loadComponent: () => import('./components/approve-farmers/approve-farmers.component').then(m => m.ApproveFarmersComponent),
    title: 'Admin - Duyệt Nông dân',
    data: { breadcrumb: 'Duyệt Nông Dân' } // << THÊM
  },
  {
    path: 'categories', // Path: /admin/categories
    loadComponent: () => import('./components/manage-categories/manage-categories.component').then(m => m.ManageCategoriesComponent),
    title: 'Admin - Quản lý Danh mục',
    data: { breadcrumb: 'Quản Lý Danh Mục' } // << THÊM
  },
  {
    path: 'products', // Path: /admin/products (Quản lý & Duyệt)
    loadComponent: () => import('./components/manage-all-products/manage-all-products.component').then(m => m.ManageAllProductsComponent),
    title: 'Admin - Quản lý Sản phẩm',
    data: { breadcrumb: 'Quản Lý Sản Phẩm' } // << THÊM
  },
  {
    path: 'orders', // Path: /admin/orders
    loadComponent: () => import('./components/manage-all-orders/manage-all-orders.component').then(m => m.ManageAllOrdersComponent),
    title: 'Admin - Quản lý Đơn hàng',
    data: { breadcrumb: 'Quản Lý Đơn Hàng' } // << THÊM
  },
  {
    path: 'orders/:id', // Path: /admin/orders/:id
    loadComponent: () => import('../ordering/components/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    data: {
      isAdminView: true,
      breadcrumb: 'Chi Tiết Đơn Hàng' // << THÊM
    },
    title: 'Admin - Chi tiết Đơn hàng'
  },
  {
    path: 'reviews/pending', // Path: /admin/reviews/pending
    loadComponent: () => import('./components/approve-reviews/approve-reviews.component').then(m => m.ApproveReviewsComponent),
    title: 'Admin - Duyệt Đánh giá',
    data: { breadcrumb: 'Quản Lý Đánh Giá' } // << THÊM
  },
  {
    path: 'roles', // Path: /admin/roles
    loadComponent: () => import('./components/manage-roles/manage-roles.component').then(m => m.ManageRolesComponent),
    title: 'Admin - Quản lý Phân quyền',
    data: { breadcrumb: 'Quản Lý Phân Quyền' } // << THÊM
  },
  {
    path: 'invoices', // Path: /admin/invoices
    loadComponent: () => import('./components/manage-invoice-list/manage-invoice-list.component').then(m => m.ManageInvoiceListComponent),
    title: 'Quản lý Hóa đơn Công nợ',
    data: { breadcrumb: 'Quản Lý Hóa Đơn' } // << THÊM
  },
  // Redirect mặc định của /admin về /admin/dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
