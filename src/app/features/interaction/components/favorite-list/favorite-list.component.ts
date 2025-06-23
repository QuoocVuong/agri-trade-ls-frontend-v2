import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FavoriteService } from '../../service/FavoriteService';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import { Page } from '../../../../core/models/page.model';
import { PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ProductCardComponent } from '../../../catalog/components/product-card/product-card.component';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-favorite-list',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, ProductCardComponent],
  templateUrl: './favorite-list.component.html',
})
export class FavoriteListComponent implements OnInit {
  private favoriteService = inject(FavoriteService);
  private authService = inject(AuthService); // Cần để đảm bảo user đã login

  favoritesPage = signal<Page<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Phân trang
  currentPage = signal(0);
  pageSize = signal(12); // Số sản phẩm mỗi trang
  sort = signal('addedAt,desc'); // Sắp xếp theo ngày thêm mới nhất

  ngOnInit(): void {
    // Đảm bảo user đã đăng nhập trước khi load (có thể dùng guard ở route)
    if (this.authService.isAuthenticated()) {
      this.loadFavorites();
    } else {
      this.errorMessage.set("Vui lòng đăng nhập để xem danh sách yêu thích.");
      this.isLoading.set(false);
    }
  }

  loadFavorites(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const page = this.currentPage();
    const size = this.pageSize();
    const sort = this.sort();

    this.favoriteService.getMyFavorites(page, size, sort).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.favoritesPage.set(response.data);
        } else {
          this.favoritesPage.set(null);
          // Không báo lỗi nếu chỉ là danh sách trống
          if(response.status !== 404 && !response.success) this.errorMessage.set(response.message || 'Không tải được danh sách yêu thích.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.favoritesPage.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi.');
        this.isLoading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadFavorites(); // Load lại trang mới
  }

  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }

  // Hàm xử lý khi người dùng unfavorite trực tiếp từ card (nếu ProductCard có Output event)
  handleUnfavorited(productId: number): void {
    this.favoritesPage.update(page => {
      if (!page) return null;
      const updatedContent = page.content.filter(p => p.id !== productId);
      const updatedPage = {
        ...page,
        content: updatedContent,
        totalElements: page.totalElements - 1,
      };
      // Nếu trang hiện tại không còn sản phẩm, chuyển về trang trước hoặc reload
      if (updatedContent.length === 0 && page.number > 0) {
        this.currentPage.set(page.number - 1);
        this.loadFavorites();
        return page; // Trả về page hiện tại, loadFavorites sẽ cập nhật
      }
      return updatedPage;
    });
  }
}
