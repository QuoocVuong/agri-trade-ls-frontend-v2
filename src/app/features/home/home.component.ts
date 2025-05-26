import {Component, OnInit, inject, signal, ElementRef, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import { CategoryService } from '../catalog/services/category.service'; // Import CategoryService
import { ProductService } from '../catalog/services/product.service';   // Import ProductService
// Import các DTOs cần thiết
import { CategoryResponse } from '../catalog/dto/response/CategoryResponse';
import { ProductSummaryResponse } from '../catalog/dto/response/ProductSummaryResponse';
// Import các component dùng chung
import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { ProductCardComponent } from '../catalog/components/product-card/product-card.component';
import {FarmerService} from '../user-profile/services/farmer.service';
import {FarmerSummaryResponse} from '../user-profile/dto/response/FarmerSummaryResponse';
import {takeUntil} from 'rxjs/operators';
import {LocationService} from '../../core/services/location.service';
import {Subject} from 'rxjs'; // Import ProductCard

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
  private farmerService = inject(FarmerService);
  private router = inject(Router);
  private locationService = inject(LocationService);
  private destroy$ = new Subject<void>();

  // Signals để lưu trữ dữ liệu
  featuredCategories = signal<CategoryResponse[]>([]);
  newestProducts = signal<ProductSummaryResponse[]>([]);
   featuredFarmers = signal<any[]>([]); // Cần DTO và Service riêng cho Farmer Info

  // Signals cho trạng thái loading/error
  isLoadingCategories = signal(true);
  isLoadingProducts = signal(true);
   isLoadingFarmers = signal(true);
  errorMessage = signal<string | null>(null);



  provinceName = signal<string | null>(null);

  // Tham chiếu đến input tìm kiếm trong hero section
  @ViewChild('heroSearchInput') heroSearchInputRef?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.loadFeaturedCategories();
    this.loadNewestProducts();
     this.loadFeaturedFarmers();
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

  loadFeaturedFarmers(): void {
    this.isLoadingFarmers.set(true);
    this.errorMessage.set(null); // Thêm reset lỗi
    // TODO: Gọi API lấy danh sách nông dân nổi bật
    // Ví dụ: Giả sử bạn có FarmerService và DTO FarmerSummaryResponse
    this.farmerService.getFeaturedFarmers({ limit: 4 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.featuredFarmers.set(res.data); // Cần đúng kiểu dữ liệu
        } else {  // Xử lý nếu không có data hoặc lỗi nhẹ
          console.warn("Could not load featured farmers:", res.message);
        }
      },
      error: (err) => {  console.error("Error loading featured farmers:", err);
        // Có thể set errorMessage nếu đây là lỗi quan trọng
      },
      complete: () => this.isLoadingFarmers.set(false)
    });

    // Giữ lại setTimeout để giả lập nếu chưa có API
    // setTimeout(() => {
    //   // Giả lập dữ liệu (thay bằng dữ liệu thật từ API)
    //   this.featuredFarmers.set([
    //     { id: 1, farmName: 'Trang trại Rau Sạch A', avatarUrl: null, address: 'Huyện X, Lạng Sơn' },
    //     { id: 2, farmName: 'Vườn trái cây B', avatarUrl: null, address: 'Huyện Y, Lạng Sơn' },
    //     { id: 3, farmName: 'Nông sản Hữu Cơ C', avatarUrl: null, address: 'Huyện Z, Lạng Sơn' },
    //     { id: 4, farmName: 'Trang trại Mật Ong D', avatarUrl: null, address: 'Huyện X, Lạng Sơn' }
    //   ]);
    //   this.isLoadingFarmers.set(false);
    // }, 1500);
  }

  // --- THÊM PHƯƠNG THỨC TÌM KIẾM ---
  performHeroSearch(searchTerm: string): void {
    const trimmedSearchTerm = searchTerm?.trim();
    if (trimmedSearchTerm) {
      // Điều hướng đến trang sản phẩm với query param là keyword
      this.router.navigate(['/products'], { queryParams: { keyword: trimmedSearchTerm } });
      // Xóa nội dung input sau khi tìm kiếm (nếu muốn)
      if (this.heroSearchInputRef) {
        this.heroSearchInputRef.nativeElement.value = '';
      }
    }
  }
  // ---------------------------------

  // Hàm trackBy cho *ngFor
  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
  trackCategoryById(index: number, item: CategoryResponse): number {
    return item.id;
  }
  // Thêm trackBy cho farmer nếu cần
  trackFarmerById(index: number, item: FarmerSummaryResponse): number { // Sửa any thành DTO phù hợp
    return item.userId; // Hoặc item.userId tùy theo DTO
  }

  loadProvinceName(provinceCode: string | null | undefined): void {
    if (!provinceCode) {
      this.provinceName.set('Không xác định');
      return;
    }
    this.locationService.findProvinceName(provinceCode ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(name => this.provinceName.set(name || `Mã ${provinceCode}`));
  }

}
