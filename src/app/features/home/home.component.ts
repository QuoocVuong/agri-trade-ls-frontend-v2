import {Component, OnInit, inject, signal, ElementRef, ViewChild} from '@angular/core';
import { CommonModule } from '@angular/common';
import {Router, RouterLink} from '@angular/router';
import { CategoryService } from '../catalog/services/category.service';
import {ProductService, SupplySourceSearchParams} from '../catalog/services/product.service';
import { CategoryResponse } from '../catalog/dto/response/CategoryResponse';
import { ProductSummaryResponse } from '../catalog/dto/response/ProductSummaryResponse';

import { LoadingSpinnerComponent } from '../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../shared/components/alert/alert.component';
import { ProductCardComponent } from '../catalog/components/product-card/product-card.component';
import {FarmerService} from '../user-profile/services/farmer.service';
import {FarmerSummaryResponse} from '../user-profile/dto/response/FarmerSummaryResponse';
import {takeUntil} from 'rxjs/operators';
import {LocationService} from '../../core/services/location.service';
import {Subject} from 'rxjs';
import {FormsModule} from '@angular/forms';
import {SupplySourceResponse} from '../catalog/dto/response/SupplySourceResponse';
import {SupplySourceCardComponent} from '../catalog/components/supply-source-card/supply-source-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    ProductCardComponent,
    FormsModule,
    SupplySourceCardComponent,

  ],
  templateUrl: './home.component.html',

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
   featuredFarmers = signal<any[]>([]);

  // Signals cho trạng thái loading/error
  isLoadingCategories = signal(true);
  isLoadingProducts = signal(true);
   isLoadingFarmers = signal(true);
  errorMessage = signal<string | null>(null);



  provinceName = signal<string | null>(null);

  searchTypeSignal = signal<'products' | 'supplies'>('products'); // Mặc định

  updateSearchPlaceholder(): void {
    // Có thể cập nhật placeholder của input nếu cần
  }

  newestSupplies = signal<SupplySourceResponse[]>([]);
  isLoadingNewestSupplies = signal(true);



  // Tham chiếu đến input tìm kiếm trong hero section
  @ViewChild('heroSearchInput') heroSearchInputRef?: ElementRef<HTMLInputElement>;

  ngOnInit(): void {
    this.loadFeaturedCategories();
    this.loadNewestProducts();
     this.loadFeaturedFarmers();
    this.loadNewestSupplySources();
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

    this.farmerService.getFeaturedFarmers({ limit: 4 }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          const farmersWithProvinceName = res.data.map(farmer => ({
            ...farmer,
            provinceNameDisplay: signal<string | null>(null) // Signal riêng cho mỗi farmer
          }));
          this.featuredFarmers.set(farmersWithProvinceName);

          // Load tên tỉnh cho từng farmer
          farmersWithProvinceName.forEach(farmer => {
            if (farmer.provinceCode) {
              this.locationService.findProvinceName(farmer.provinceCode)
                .pipe(takeUntil(this.destroy$)) // Nhớ unsubscribe
                .subscribe(name => farmer.provinceNameDisplay.set(name || farmer.provinceCode));
            } else {
              farmer.provinceNameDisplay.set('N/A');
            }
          });
        }
      },
      error: (err) => {  console.error("Error loading featured farmers:", err);
        // Có thể set errorMessage nếu đây là lỗi quan trọng
      },
      complete: () => this.isLoadingFarmers.set(false)
    });


  }
  loadNewestSupplySources(): void {
    this.isLoadingNewestSupplies.set(true);
    const params: SupplySourceSearchParams = { // Dùng interface params của supply source
      page: 0,
      size: 4, // Lấy 4 nguồn cung mới nhất
      sort: 'createdAt,desc' // Sắp xếp theo ngày tạo sản phẩm (nguồn cung)
    };
    this.productService.findSupplySources(params).subscribe({ // Gọi API tìm nguồn cung
      next: (res) => {
        if (res.success && res.data) {
          this.newestSupplies.set(res.data.content);
        } else {
          console.warn("Could not load newest supply sources:", res.message);
        }
      },
      error: (err) => {
        console.error("Error loading newest supply sources:", err);
      },
      complete: () => this.isLoadingNewestSupplies.set(false)
    });
  }

  trackSupplyById(index: number, item: SupplySourceResponse): number {
    return item.productId; // Hoặc một ID duy nhất khác từ SupplySourceResponse
  }

  // --- PHƯƠNG THỨC TÌM KIẾM ---
  performHeroSearch(searchTerm: string): void {
    const trimmedSearchTerm = searchTerm?.trim();
    if (trimmedSearchTerm) {
      const targetPath = this.searchTypeSignal() === 'products' ? '/products' : '/supply-sources';
      this.router.navigate([targetPath], { queryParams: { keyword: trimmedSearchTerm } });
      if (this.heroSearchInputRef) {
        this.heroSearchInputRef.nativeElement.value = '';
      }
    }
  }


  // Hàm trackBy cho *ngFor
  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
  trackCategoryById(index: number, item: CategoryResponse): number {
    return item.id;
  }

  trackFarmerById(index: number, item: FarmerSummaryResponse): number {
    return item.userId;
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
