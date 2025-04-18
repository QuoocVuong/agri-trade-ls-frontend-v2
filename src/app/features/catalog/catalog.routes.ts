import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '', // Route gốc của feature (ví dụ: /products)
    loadComponent: () => import('./components/product-list/product-list.component').then(m => m.ProductListComponent),
    title: 'Danh sách Sản phẩm'
  },
  // Route cho danh sách sản phẩm theo category slug đã có ở app.routes.ts
  // {
  //   path: 'category/:slug', // Ví dụ: /products/category/rau-sach
  //   loadComponent: () => import('./components/product-list/product-list.component').then(m => m.ProductListComponent),
  //   title: 'Sản phẩm theo Danh mục'
  // },
  // Route cho chi tiết sản phẩm đã có ở app.routes.ts
  // {
  //   path: ':slug', // Ví dụ: /products/rau-muong-sach
  //   loadComponent: () => import('./components/product-detail/product-detail.component').then(m => m.ProductDetailComponent),
  //   // Title có thể set động trong component dựa vào tên sản phẩm
  // }
];
