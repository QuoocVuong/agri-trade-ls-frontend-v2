

import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';
import { AuthLayoutComponent } from './core/layouts/auth-layout/auth-layout.component';
import { AdminDashboardLayoutComponent } from './core/layouts/admin-dashboard-layout/admin-dashboard-layout.component';
import { FarmerDashboardLayoutComponent } from './core/layouts/farmer-dashboard-layout/farmer-dashboard-layout.component';
import { UserDashboardLayoutComponent } from './core/layouts/user-dashboard-layout/user-dashboard-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import {
  NotificationListComponent
} from './features/notification/components/notification-list/notification-list.component';

export const routes: Routes = [


  // --- Auth Routes (Sử dụng AuthLayoutComponent) ---
  {
    path: 'auth',
    component: AuthLayoutComponent,
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // --- User Authenticated Routes (Sử dụng UserDashboardLayoutComponent) ---
  {
    path: 'user', // Base path cho các trang của user đã đăng nhập
    component: UserDashboardLayoutComponent,
    canActivate: [authGuard], // Yêu cầu đăng nhập chung
    children: [
      {
        path: 'profile', // Path: /user/profile và các route con của nó
        loadChildren: () => import('./features/user-profile/user-profile.routes').then(m => m.USER_PROFILE_ROUTES)
      },
      { // *** THÊM ROUTE RIÊNG CHO ADDRESSES ***
        path: 'addresses', // Path: /user/addresses
        loadComponent: () => import('./features/user-profile/components/address-list/address-list.component').then(m => m.AddressListComponent),
        title: 'Sổ địa chỉ'
      },
      {
        path: 'orders', // Path: /user/orders và các route con của nó (history, detail)
        loadChildren: () => import('./features/ordering/ordering.routes').then(m => m.ORDERING_ROUTES)
      },
      {
        path: 'favorites', // Path: /user/favorites
        loadComponent: () => import('./features/interaction/components/favorite-list/favorite-list.component').then(m => m.FavoriteListComponent),
        title: 'Sản phẩm yêu thích'
      },
      {
        path: 'my-reviews', // Path: /user/my-reviews
        loadComponent: () => import('./features/interaction/components/review-list/review-list.component').then(m => m.ReviewListComponent),
        data: { mode: 'my' },
        title: 'Đánh giá của tôi'
      },
      {
        path: 'notifications', // <-- Route cho trang danh sách thông báo
        loadComponent: () => import('./features/notification/components/notification-list/notification-list.component').then(m => m.NotificationListComponent), // Component trang thông báo
        title: 'Tất cả thông báo'
      },
      // Các route đăng ký profile có thể nằm trong user-profile.routes.ts hoặc để ở đây nếu muốn URL riêng
      // { path: 'register-farmer', ... },
      // { path: 'register-business', ... },
      { path: '', redirectTo: 'profile', pathMatch: 'full' } // Redirect /user về /user/profile
    ]
  },

  // --- Chat Route (Ví dụ đặt trong UserDashboardLayout) ---
  {
     path: 'chat',
     component: UserDashboardLayoutComponent, // Dùng layout user
    // canActivate: [authGuard],
    // loadComponent: () => import('./features/interaction/components/chat/chat-layout/chat-layout.component').then(m => m.ChatLayoutComponent),
    // title: 'Tin nhắn'
    // Hoặc dùng loadChildren nếu interaction có file route riêng
     loadChildren: () => import('./features/interaction/interaction.routes').then(m => m.INTERACTION_ROUTES)
  },


  // --- Farmer Routes (Sử dụng FarmerDashboardLayoutComponent) ---
  {
    path: 'farmer',
    component: FarmerDashboardLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['ROLE_FARMER'] }, // Sửa thành mảng nếu RoleGuard hỗ trợ
    loadChildren: () => import('./features/farmer-dashboard/farmer.routes').then(m => m.FARMER_ROUTES) // Tạo file farmer.routes.ts
  },

  // --- Admin Routes (Sử dụng AdminDashboardLayoutComponent) ---
  {
    path: 'admin',
    component: AdminDashboardLayoutComponent,
    canActivate: [authGuard, roleGuard],
    data: { expectedRoles: ['ROLE_ADMIN'] },
    loadChildren: () => import('./features/admin-dashboard/admin.routes').then(m => m.ADMIN_ROUTES) // Tạo file admin.routes.ts
  },

  // --- Public Routes (Sử dụng PublicLayoutComponent) ---
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '', // Trang chủ
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        title: 'AgriTrade - Nông sản sạch Lạng Sơn'
      },

      // {
      //   path: 'products', // Tất cả các route bắt đầu bằng /products
      //   loadChildren: () => import('./features/catalog/catalog.routes').then(m => m.CATALOG_ROUTES)
      // },
      {
        path: 'products', // Trang danh sách sản phẩm B2C
        loadComponent: () => import('./features/catalog/components/product-list/product-list.component').then(m => m.ProductListComponent),
        title: 'Sản phẩm Nông sản'
      },
      { // Route chi tiết sản phẩm (đặt ở đây để URL là /products/:slug)
        path: 'products/:slug', // Chi tiết sản phẩm B2C
        loadComponent: () => import('./features/catalog/components/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
        // Title sẽ được set động trong component
      },
      { // Route lọc theo category (đặt ở đây để URL là /categories/:slug)
        path: 'categories/:slug', // Sản phẩm B2C theo category
        loadComponent: () => import('./features/catalog/components/product-list/product-list.component').then(m => m.ProductListComponent)
        // Title sẽ được set động trong component
      },

      // --- LUỒNG TÌM KIẾM NGUỒN CUNG (MỚI) ---
      {
        path: 'supply-sources', // URL: /supply-sources
        loadComponent: () => import('./features/catalog/components/supply-source-list/supply-source-list.component').then(m => m.SupplySourceListComponent),
        title: 'Tìm Nguồn Cung Nông Sản'
      },
      {
        path: 'supply-sources/category/:categorySlug', // URL: /supply-sources/category/rau-cu
        loadComponent: () => import('./features/catalog/components/supply-source-list/supply-source-list.component').then(m => m.SupplySourceListComponent),
        // Title sẽ được set động dựa trên category
      },
      {
        path: 'supply-sources/detail/:productSlug', // URL: /supply-sources/detail/ca-rot-da-lat
        loadComponent: () => import('./features/catalog/components/supply-source-detail/supply-source-detail.component').then(m => m.SupplySourceDetailComponent),
        // Title sẽ được set động dựa trên tên sản phẩm/nguồn cung
      },
      // ---------------------------------------

      { // Route Giỏ hàng (đặt trong layout public hoặc user đều được, ở đây ví dụ public)
        path: 'cart',
        loadComponent: () => import('./features/ordering/components/cart/cart.component').then(m => m.CartComponent),
        canActivate: [authGuard], // Yêu cầu đăng nhập
        title: 'Giỏ hàng'
      },
      { // Route Checkout (đặt trong layout public hoặc user)
        path: 'checkout',
        loadComponent: () => import('./features/ordering/components/checkout/checkout.component').then(m => m.CheckoutComponent),
        canActivate: [authGuard],
        title: 'Thanh toán'
      },

      {
        path: 'farmer/:id', // Đường dẫn công khai xem thông tin farmer theo ID
        loadComponent: () => import('./features/user-profile/components/farmer-public-profile/farmer-public-profile.component').then(m => m.FarmerPublicProfileComponent), // Component bạn cần tạo
        title: 'Thông tin Nhà bán hàng' // Hoặc đặt title động trong component
      },
      {
        path: 'farmers', // Đường dẫn khớp với routerLink
        loadComponent: () => import('./features/user-profile/components/farmer-list/farmer-list.component').then(m => m.FarmerListComponent), // Component mới tạo
        title: 'Danh sách Nhà bán'
      },

      // THÊM CÁC ROUTE MỚI Ở ĐÂY
      {
        path: 'about-us', // URL: /about-us
        loadComponent: () => import('./features/public-pages/about-us/about-us.component').then(m => m.AboutUsComponent),
        title: 'Về chúng tôi - AgriTrade'
      },
      {
        path: 'contact', // URL: /contact
        loadComponent: () => import('./features/public-pages/contact/contact.component').then(m => m.ContactComponent),
        title: 'Liên hệ - AgriTrade'
      },
      {
        path: 'policy', // URL: /policy
        loadComponent: () => import('./features/public-pages/policy/policy.component').then(m => m.PolicyComponent),
        title: 'Chính sách - AgriTrade'
      },
      {
        path: 'terms', // URL: /terms
        loadComponent: () => import('./features/public-pages/terms/terms.component').then(m => m.TermsComponent),
        title: 'Điều khoản dịch vụ - AgriTrade'
      },


      {
        path: 'unauthorized',
        //component: PublicLayoutComponent, // Hoặc layout riêng
        loadComponent: () => import('./core/components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent),
        title: 'Không có quyền truy cập'
      },
      {
        path: 'not-found',
        //component: PublicLayoutComponent, // Hoặc layout riêng
        loadComponent: () => import('./core/components/not-found/not-found.component').then(m => m.NotFoundComponent),
        title: 'Không tìm thấy trang'
      },
      // Thêm các trang public khác nếu có (About, Contact...)
    ]
  },

  {
    path: 'payment/vnpay/result', // ĐÚNG: Route này sẽ được VNPAY gọi
    loadComponent: () => import('./features/ordering/components/vnpay-result/vnpay-result.component').then(m => m.VnpayResultComponent),
    title: 'Kết quả thanh toán VNPAY'
  },

  // --- Not Found & Unauthorized Routes ---

  { path: '**', redirectTo: '/not-found' } // Đặt ở cuối cùng
];

