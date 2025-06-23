import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  {
    path: '', // Route gốc của feature (ví dụ: /products)
    loadComponent: () => import('./components/product-list/product-list.component').then(m => m.ProductListComponent),
    title: 'Danh sách Sản phẩm'
  },

];
