import { Routes } from '@angular/router';

// Các route con bên trong /farmer
export const FARMER_ROUTES: Routes = [
  {
    path: 'dashboard', // Path: /farmer/dashboard
    loadComponent: () => import('./components/farmer-stats/farmer-stats.component').then(m => m.FarmerStatsComponent),
    title: 'Kênh người bán - Bảng điều khiển'
  },
  {
    path: 'products', // Path: /farmer/products
    loadComponent: () => import('./components/manage-products/manage-products.component').then(m => m.ManageProductsComponent),
    title: 'Kênh người bán - Quản lý Sản phẩm'
  },
  {
    path: 'products/new', // Path: /farmer/products/new
    loadComponent: () => import('./components/edit-product/edit-product.component').then(m => m.EditProductComponent),
    title: 'Kênh người bán - Thêm Sản phẩm'
  },
  {
    path: 'products/edit/:id', // Path: /farmer/products/edit/:id
    loadComponent: () => import('./components/edit-product/edit-product.component').then(m => m.EditProductComponent),
    title: 'Kênh người bán - Sửa Sản phẩm'
  },
  {
    path: 'orders', // Path: /farmer/orders
    loadComponent: () => import('./components/manage-orders/manage-orders.component').then(m => m.ManageOrdersComponent),
    title: 'Kênh người bán - Quản lý Đơn hàng'
  },
  { // Route chi tiết đơn hàng cho Farmer (có thể dùng chung OrderDetailComponent)
    path: 'orders/:id', // Path: /farmer/orders/:id
    loadComponent: () => import('../ordering/components/order-detail/order-detail.component').then(m => m.OrderDetailComponent),
    data: { isFarmerView: true }, // Truyền data để component biết là view của Farmer
    title: 'Kênh người bán - Chi tiết Đơn hàng'
  },
  // { path: 'reviews', loadComponent: () => ..., title: 'Kênh người bán - Đánh giá' }, // Nếu cần xem review về SP của mình
  { // Link đến trang sửa profile farmer (đã có trong user-profile)
    path: 'profile',
    redirectTo: '/user/profile/farmer-profile', // Redirect đến trang sửa profile đã có
    pathMatch: 'full'
  },
  // Redirect mặc định của /farmer về /farmer/dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
