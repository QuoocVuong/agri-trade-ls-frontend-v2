

import { Routes } from '@angular/router';
import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';
import { AuthLayoutComponent } from './core/layouts/auth-layout/auth-layout.component';
import { AdminDashboardLayoutComponent } from './core/layouts/admin-dashboard-layout/admin-dashboard-layout.component';
import { FarmerDashboardLayoutComponent } from './core/layouts/farmer-dashboard-layout/farmer-dashboard-layout.component';
import { UserDashboardLayoutComponent } from './core/layouts/user-dashboard-layout/user-dashboard-layout.component';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // --- Public Routes (Sử dụng PublicLayoutComponent) ---
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      {
        path: '', // Trang chủ
        loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
        title: 'AgriTradeLS - Nông sản sạch Lạng Sơn'
      },

      {
        path: 'products', // Tất cả các route bắt đầu bằng /products
        loadChildren: () => import('./features/catalog/catalog.routes').then(m => m.CATALOG_ROUTES)
      },
      { // Route chi tiết sản phẩm (đặt ở đây để URL là /products/:slug)
        path: 'products/:slug',
        loadComponent: () => import('./features/catalog/components/product-detail/product-detail.component').then(m => m.ProductDetailComponent)
        // Title sẽ được set động trong component
      },
      { // Route lọc theo category (đặt ở đây để URL là /categories/:slug)
        path: 'categories/:slug',
        loadComponent: () => import('./features/catalog/components/product-list/product-list.component').then(m => m.ProductListComponent)
        // Title sẽ được set động trong component
      },
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

  // --- Not Found & Unauthorized Routes ---

  { path: '**', redirectTo: '/not-found' } // Đặt ở cuối cùng
];

// import { Routes } from '@angular/router';
// import { PublicLayoutComponent } from './core/layouts/public-layout/public-layout.component';
// import { AuthLayoutComponent } from './core/layouts/auth-layout/auth-layout.component';
// import { AdminDashboardLayoutComponent } from './core/layouts/admin-dashboard-layout/admin-dashboard-layout.component';
// import { FarmerDashboardLayoutComponent } from './core/layouts/farmer-dashboard-layout/farmer-dashboard-layout.component';
// import { UserDashboardLayoutComponent } from './core/layouts/user-dashboard-layout/user-dashboard-layout.component';
// import { authGuard } from './core/guards/auth.guard'; // Sẽ tạo guard này
// import { roleGuard } from './core/guards/role.guard'; // Sẽ tạo guard này
//
// export const routes: Routes = [
//   // --- Public Routes ---
//   {
//     path: '',
//     component: PublicLayoutComponent, // Layout chung cho trang public
//     children: [
//       { path: '', // Route gốc (trang chủ)
//         loadComponent: () => import('./features/home/home.component').then(m => m.HomeComponent),
//         title: 'AgriTradeLS - Nông sản sạch Lạng Sơn' }, // Trang chủ
//       { path: 'products', loadChildren: () => import('./features/catalog/catalog.routes').then(m => m.CATALOG_ROUTES) },
//       { path: 'products/:slug', loadComponent: () => import('./features/catalog/components/product-detail/product-detail.component').then(m => m.ProductDetailComponent) },
//       { path: 'categories/:slug', loadComponent: () => import('./features/catalog/components/product-list/product-list.component').then(m => m.ProductListComponent) }, // Lọc theo category
//       // Thêm các trang public khác (Giới thiệu, Liên hệ...)
//
//     ]
//   },
//
//   {
//     path: 'unauthorized', // Đường dẫn cho trang không có quyền
//     // Có thể đặt trong PublicLayout hoặc layout riêng
//     loadComponent: () => import('./core/components/unauthorized/unauthorized.component').then(m => m.UnauthorizedComponent)
//   },
//
//
//   // --- Auth Routes ---
//   {
//     path: 'auth',
//     component: AuthLayoutComponent, // Layout riêng cho trang auth
//     loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES) // Lazy load routes
//   },
//   // {
//   //   path: 'auth',
//   //   component: AuthLayoutComponent, // Layout riêng cho trang auth
//   //   children: [
//   //     { path: 'login', loadComponent: () => import('./features/auth/components/login/login.component').then(m => m.LoginComponent) },
//   //     { path: 'register', loadComponent: () => import('./features/auth/components/register/register.component').then(m => m.RegisterComponent) },
//   //     { path: 'forgot-password', loadComponent: () => import('./features/auth/components/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
//   //     { path: 'reset-password', loadComponent: () => import('./features/auth/components/reset-password/reset-password.component').then(m => m.ResetPasswordComponent) },
//   //     { path: 'verify-email', loadComponent: () => import('./features/auth/components/verify-email/verify-email.component').then(m => m.VerifyEmailComponent) },
//   //   ]
//   // },
//
//   // --- User Authenticated Routes (Consumer/Business Buyer) ---
//   {
//     path: 'user', // Hoặc để trống nếu muốn dùng chung layout public? Hoặc dùng layout riêng
//     component: UserDashboardLayoutComponent, // Layout cho user đã login
//     canActivate: [authGuard], // Yêu cầu đăng nhập
//     children: [
//       // { path: 'profile', loadComponent: () => import('./features/user-profile/components/profile-view/profile-view.component').then(m => m.ProfileViewComponent) },
//       // { path: 'edit-profile', loadComponent: () => import('./features/user-profile/components/edit-profile/edit-profile.component').then(m => m.EditProfileComponent) },
//       // { path: 'change-password', loadComponent: () => import('./features/user-profile/components/change-password/change-password.component').then(m => m.ChangePasswordComponent) },
//       // { path: 'addresses', loadComponent: () => import('./features/user-profile/components/address-list/address-list.component').then(m => m.AddressListComponent) },
//       { path: 'profile', loadChildren: () => import('./features/user-profile/user-profile.routes').then(m => m.USER_PROFILE_ROUTES) },
//       // { path: 'orders', loadComponent: () => import('./features/ordering/components/order-history/order-history.component').then(m => m.OrderHistoryComponent) },
//       {
//         path: 'orders', // Path: /user/orders
//         loadChildren: () => import('./features/ordering/ordering.routes').then(m => m.ORDERING_ROUTES) // Load các route history, detail
//       },
//       { path: 'favorites', loadComponent: () => import('./features/interaction/components/favorite-list/favorite-list.component').then(m => m.FavoriteListComponent) },
//       // Thêm route cho trang đăng ký farmer/business profile nếu theo cách 2
//       { path: 'register-farmer', loadComponent: () => import('./features/user-profile/components/register-farmer/register-farmer.component').then(m => m.RegisterFarmerComponent) },
//       { path: 'register-business', loadComponent: () => import('./features/user-profile/components/register-business/register-business.component').then(m => m.RegisterBusinessComponent) },
//       { path: '', redirectTo: 'profile', pathMatch: 'full' } // Redirect /user về /user/profile
//     ]
//   },
//
//   // --- Cart & Checkout Routes ---
//   {
//     path: 'cart',
//     component: PublicLayoutComponent, // Hoặc UserDashboardLayoutComponent
//     canActivate: [authGuard],
//     loadComponent: () => import('./features/ordering/components/cart/cart.component').then(m => m.CartComponent)
//   },
//   // {
//   //   path: 'cart',
//   //   component: PublicLayoutComponent, // Hoặc UserDashboardLayoutComponent
//   //   canActivate: [authGuard],
//   //   loadChildren: () => import('./features/ordering/ordering.routes').then(m => m.ORDERING_ROUTES) // Chỉ load route 'cart'
//   //   // Hoặc load component trực tiếp nếu chỉ có 1 route con
//   //   // loadComponent: () => import('./features/ordering/components/cart/cart.component').then(m => m.CartComponent)
//   // }
//
//   {
//     path: 'checkout',
//     component: PublicLayoutComponent, // Hoặc layout riêng cho checkout
//     canActivate: [authGuard],
//     loadComponent: () => import('./features/ordering/components/checkout/checkout.component').then(m => m.CheckoutComponent)
//   },
//   // {
//   //   path: 'checkout',
//   //   component: PublicLayoutComponent, // Hoặc layout riêng
//   //   canActivate: [authGuard],
//   //   loadChildren: () => import('./features/ordering/ordering.routes').then(m => m.ORDERING_ROUTES) // Chỉ load route 'checkout'
//   //   // loadComponent: () => import('./features/ordering/components/checkout/checkout.component').then(m => m.CheckoutComponent)
//   // },
//
//
//   // --- Farmer Routes ---
//   {
//     path: 'farmer',
//     component: FarmerDashboardLayoutComponent, // Layout riêng cho farmer
//     canActivate: [authGuard, roleGuard], // Yêu cầu đăng nhập và đúng role
//     data: { expectedRole: 'ROLE_FARMER' }, // Truyền role mong muốn cho guard
//     children: [
//       { path: 'dashboard', loadComponent: () => import('./features/farmer-dashboard/components/farmer-stats/farmer-stats.component').then(m => m.FarmerStatsComponent) },
//       { path: 'products', loadComponent: () => import('./features/farmer-dashboard/components/manage-products/manage-products.component').then(m => m.ManageProductsComponent) },
//       { path: 'products/new', loadComponent: () => import('./features/farmer-dashboard/components/edit-product/edit-product.component').then(m => m.EditProductComponent) },
//       { path: 'products/edit/:id', loadComponent: () => import('./features/farmer-dashboard/components/edit-product/edit-product.component').then(m => m.EditProductComponent) },
//       { path: 'orders', loadComponent: () => import('./features/farmer-dashboard/components/manage-orders/manage-orders.component').then(m => m.ManageOrdersComponent) },
//       // { path: 'reviews', ... },
//       // { path: 'profile', ... }, // Link đến trang sửa farmer profile
//     ]
//   },
//
//   // --- Admin Routes ---
//   {
//     path: 'admin',
//     component: AdminDashboardLayoutComponent, // Layout riêng cho admin
//     canActivate: [authGuard, roleGuard],
//     data: { expectedRole: 'ROLE_ADMIN' },
//     children: [
//       { path: 'dashboard', loadComponent: () => import('./features/admin-dashboard/components/admin-stats/admin-stats.component').then(m => m.AdminStatsComponent) },
//       { path: 'users', loadComponent: () => import('./features/admin-dashboard/components/manage-users/manage-users.component').then(m => m.ManageUsersComponent) },
//       { path: 'farmers/pending', loadComponent: () => import('./features/admin-dashboard/components/approve-farmers/approve-farmers.component').then(m => m.ApproveFarmersComponent) },
//       { path: 'categories', loadComponent: () => import('./features/admin-dashboard/components/manage-categories/manage-categories.component').then(m => m.ManageCategoriesComponent) },
//       { path: 'products', loadComponent: () => import('./features/admin-dashboard/components/manage-all-products/manage-all-products.component').then(m => m.ManageAllProductsComponent) }, // Quản lý/duyệt SP
//       { path: 'orders', loadComponent: () => import('./features/admin-dashboard/components/manage-all-orders/manage-all-orders.component').then(m => m.ManageAllOrdersComponent) },
//       { path: 'reviews/pending', loadComponent: () => import('./features/admin-dashboard/components/approve-reviews/approve-reviews.component').then(m => m.ApproveReviewsComponent) },
//       { path: 'roles', loadComponent: () => import('./features/admin-dashboard/components/manage-roles/manage-roles.component').then(m => m.ManageRolesComponent) },
//     ]
//   },
//
//   // --- Chat Route (Ví dụ) ---
//   // {
//   //   path: 'chat',
//   //   component: UserDashboardLayoutComponent, // Hoặc layout riêng cho chat
//   //   canActivate: [authGuard],
//   //   loadComponent: () => import('./features/interaction/components/chat/chat-layout/chat-layout.component').then(m => m.ChatLayoutComponent)
//   // },
//   {
//     path: '', // Layout public hoặc user dashboard
//     component: UserDashboardLayoutComponent, // Ví dụ
//     canActivate: [authGuard],
//     children: [
//       // ... các route khác
//       { path: 'chat', loadChildren: () => import('./features/interaction/interaction.routes').then(m => m.INTERACTION_ROUTES) },
//       // ...
//     ]
//   },
//
//
//   // --- Not Found Route ---
//   { path: 'not-found', loadComponent: () => import('./core/components/not-found/not-found.component').then(m => m.NotFoundComponent) }, // Tạo component này
//   { path: '**', redirectTo: '/not-found' } // Redirect mọi route không khớp về not-found
// ];
