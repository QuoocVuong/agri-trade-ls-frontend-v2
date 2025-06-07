import { Routes } from '@angular/router';
import {authGuard} from '../../core/guards/auth.guard';

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

  {
    path: 'agreed-order/new',
    loadComponent: () => import('./components/agreed-order-form/agreed-order-form.component').then(m => m.AgreedOrderFormComponent),
    title: 'Tạo Đơn Hàng Thỏa Thuận'
    // Không cần canActivate và data ở đây nữa vì FARMER_ROUTES đã có rồi
  },

  // { path: 'reviews', loadComponent: () => ..., title: 'Kênh người bán - Đánh giá' }, // Nếu cần xem review về SP của mình
  { // Link đến trang sửa profile farmer (đã có trong user-profile)
    path: 'profile',
    redirectTo: '/user/profile/farmer-profile', // Redirect đến trang sửa profile đã có
    pathMatch: 'full'
  },
  {
    path: 'reviews',
    loadComponent: () => import('./components/farmer-reviews/farmer-reviews.component').then(m => m.FarmerReviewsComponent),
    title: 'Kênh người bán - Đánh giá sản phẩm' // <<< Đổi title cho phù hợp
  },
  {
    path: 'my-supplies', // Trang quản lý danh sách nguồn cung của farmer
    loadComponent: () => import('./components/manage-supply/farmer-supply-list.component').then(m => m.FarmerSupplyListComponent),
    title: 'Nguồn Cung Của Tôi'
  },

  {
    path: 'supply/new', // Tạo nguồn cung mới
    loadComponent: () => import('../farmer-dashboard/components/supply-registration-form/supply-registration-form.component').then(m => m.SupplyRegistrationFormComponent),
    title: 'Đăng Nguồn Cung Mới'
  },
  {
    path: 'supply/edit/:productId', // Chỉnh sửa nguồn cung (dùng productId)
    loadComponent: () => import('../farmer-dashboard/components/supply-registration-form/supply-registration-form.component').then(m => m.SupplyRegistrationFormComponent),
    title: 'Chỉnh Sửa Nguồn Cung'
  },

  {
    path: 'supply-requests', // URL: /farmer/supply-requests
    loadComponent: () => import('./components/manage-supply-requests/manage-supply-requests.component').then(m => m.ManageSupplyRequestsComponent),
    title: 'Quản Lý Yêu Cầu Đặt Hàng'
  },

  {
    path: 'invoices', // Path: /farmer/invoices
    loadComponent: () => import('../admin-dashboard/components/manage-invoice-list/manage-invoice-list.component').then(m => m.ManageInvoiceListComponent),
    // Tái sử dụng ManageInvoiceListComponent nhưng sẽ có logic phân quyền trong component
    data: { viewMode: 'farmer' }, // Truyền dữ liệu để component biết ai đang xem
    title: 'Kênh người bán - Hóa đơn Công nợ'
  },

  // Redirect mặc định của /farmer về /farmer/dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
