import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CategoryService } from '../catalog/services/category.service'; // Import CategoryService
import { ProductService } from '../catalog/services/product.service';   // Import ProductService
// Import các DTOs cần thiết
import { CategoryResponse } from '../catalog/dto/response/CategoryResponse';
import { ProductSummaryResponse } from '../catalog/dto/response/ProductSummaryResponse';
// Import các component dùng chung
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { ProductCardComponent } from '../catalog/components/product-card/product-card.component'; // Import ProductCard

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    ProductCardComponent // Import component thẻ sản phẩm
  ],
  templateUrl: './home.component.html',
  //styleUrl: './home.component.css' // Có thể thêm CSS riêng
})
export class HomeComponent implements OnInit {
  private categoryService = inject(CategoryService);
  private productService = inject(ProductService);

  // Signals để lưu trữ dữ liệu
  featuredCategories = signal<CategoryResponse[]>([]);
  newestProducts = signal<ProductSummaryResponse[]>([]);
  // featuredFarmers = signal<any[]>([]); // Cần DTO và Service riêng cho Farmer Info

  // Signals cho trạng thái loading/error
  isLoadingCategories = signal(true);
  isLoadingProducts = signal(true);
  // isLoadingFarmers = signal(true);
  errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadFeaturedCategories();
    this.loadNewestProducts();
    // this.loadFeaturedFarmers();
  }

  loadFeaturedCategories(): void {
    this.isLoadingCategories.set(true);
    // Lấy một vài category gốc hoặc category được đánh dấu nổi bật từ API
    // Ví dụ: Lấy cây và chỉ hiển thị vài category gốc
    this.categoryService.getCategoryTree().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Lấy tối đa 6 category gốc làm ví dụ
          this.featuredCategories.set(res.data.slice(0, 6));
        } else {
          // Không cần báo lỗi lớn ở đây nếu chỉ là không có category nổi bật
          console.warn("Could not load featured categories:", res.message);
        }
      },
      error: (err) => {
        console.error("Error loading categories:", err);
        // Không cần set errorMessage ở đây để tránh làm trang chủ trống trơn
      },
      complete: () => this.isLoadingCategories.set(false)
    });
  }

  loadNewestProducts(): void {
    this.isLoadingProducts.set(true);
    const params = { page: 0, size: 8, sort: 'createdAt,desc' }; // Lấy 8 sản phẩm mới nhất
    this.productService.searchPublicProducts(params).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.newestProducts.set(res.data.content);
        } else {
          console.warn("Could not load newest products:", res.message);
        }
      },
      error: (err) => {
        console.error("Error loading newest products:", err);
      },
      complete: () => this.isLoadingProducts.set(false)
    });
  }

  // loadFeaturedFarmers(): void {
  //   this.isLoadingFarmers.set(true);
  //   // TODO: Gọi API lấy danh sách nông dân nổi bật (cần tạo API và Service)
  //   // Ví dụ: this.farmerService.getFeaturedFarmers(4).subscribe(...)
  //   setTimeout(() => this.isLoadingFarmers.set(false), 1000); // Giả lập loading
  // }

  // Hàm trackBy cho *ngFor
  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
  trackCategoryById(index: number, item: CategoryResponse): number {
    return item.id;
  }

}
