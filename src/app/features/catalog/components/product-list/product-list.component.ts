import {Component, OnInit, inject, signal, computed, effect, OnDestroy} from '@angular/core';
import { CommonModule } from '@angular/common';
import {ActivatedRoute, NavigationExtras, Router, RouterLink} from '@angular/router'; // Import ActivatedRoute, Router
import { ProductService, ProductSearchParams } from '../../services/product.service';
import { CategoryService } from '../../services/category.service'; // Import CategoryService
import { ProductSummaryResponse } from '../../dto/response/ProductSummaryResponse';
import { CategoryResponse } from '../../dto/response/CategoryResponse'; // Import CategoryResponse
import {ApiResponse, PagedApiResponse, PageData} from '../../../../core/models/api-response.model';
import { ProductCardComponent } from '../product-card/product-card.component'; // Import ProductCard
import { CategorySidebarComponent } from '../category-sidebar/category-sidebar.component'; // Import Sidebar
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component'; // Import Paginator
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component'; // Import Loading
import {ReactiveFormsModule, FormBuilder, Validators, FormGroup} from '@angular/forms';
import {debounceTime, distinctUntilChanged, map, switchMap, takeUntil, tap} from 'rxjs/operators';
import {combineLatest, of, Subject} from 'rxjs';
import {ToastrService} from 'ngx-toastr'; // Import FormBuilder

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule, // Thêm ReactiveFormsModule
    ProductCardComponent,
    CategorySidebarComponent,
    PaginatorComponent,
    LoadingSpinnerComponent
  ],
  templateUrl: './product-list.component.html',
})
export class ProductListComponent implements OnInit {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  public route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder); // Inject FormBuilder
  private toastr = inject(ToastrService); // Inject ToastrService

  products = signal<ProductSummaryResponse[]>([]);
  paginationData = signal<PageData<ProductSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  currentCategory = signal<CategoryResponse | null>(null); // Lưu thông tin category hiện tại (nếu lọc)

  // Form cho bộ lọc
  filterForm = this.fb.group({
    keyword: [''],
    minPrice: [null as number | null, [Validators.min(0)]], // ĐÃ CÓ
    maxPrice: [null as number | null, [Validators.min(0)]], // ĐÃ CÓ
    minRating: [0 as number | null] // ĐÃ CÓ // Mặc định là 0 (Tất cả)
    // Thêm các control khác nếu cần (giá, rating...)
  });


  searchParams = signal<ProductSearchParams>({});

  private destroy$ = new Subject<void>();

  constructor() {
    // Lắng nghe sự thay đổi của query params và route params để load lại sản phẩm
    effect(() => {
      const params = this.searchParams();
      // Chỉ load products nếu params không rỗng (đã được khởi tạo từ route)
      if (Object.keys(params).length > 0 && params.hasOwnProperty('page')) {
        this.loadProducts(params);
      }
    });
  }



  ngOnInit(): void {
    combineLatest([
      this.route.paramMap.pipe(map(params => params.get('slug'))),
      this.route.queryParamMap
    ]).pipe(
      // distinctUntilChanged không cần thiết ở đây vì combineLatest sẽ emit khi một trong hai thay đổi
      // và logic bên trong subscribe sẽ xử lý việc có cần load lại hay không.
      tap(([slug, queryParams]) => {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        const currentSlugInRoute = this.route.snapshot.paramMap.get('slug');
        if (this.currentCategory()?.slug !== currentSlugInRoute || !currentSlugInRoute) {
          this.currentCategory.set(null);
          this.products.set([]);
          this.paginationData.set(null);
        }
      }),
      switchMap(([slug, queryParams]) => {
        if (slug) {
          return this.categoryService.getCategoryBySlug(slug).pipe(
            map(categoryRes => ({ slug, categoryRes, queryParams }))
          );
        }
        return of({ slug: null, categoryRes: null, queryParams });
      }),
      takeUntil(this.destroy$)
    ).subscribe(({ slug, categoryRes, queryParams }) => {
      let categoryIdFromSlug: number | null = null;
      if (slug && categoryRes && categoryRes.success && categoryRes.data) {
        this.currentCategory.set(categoryRes.data);
        categoryIdFromSlug = categoryRes.data.id;
      } else if (slug && (!categoryRes || !categoryRes.success)) {
        this.currentCategory.set(null);
        this.errorMessage.set(`Không tìm thấy danh mục: ${slug}`);
      } else {
        this.currentCategory.set(null);
      }

      const keyword = queryParams.get('keyword');
      const page = queryParams.get('page');
      const size = queryParams.get('size');
      const sort = queryParams.get('sort');
      const minPrice = queryParams.get('minPrice');
      const maxPrice = queryParams.get('maxPrice');
      const minRating = queryParams.get('minRating');

      const newSearchParams: ProductSearchParams = {
        categoryId: categoryIdFromSlug,
        keyword: keyword ?? undefined,
        page: page ? +page : 0,
        size: size ? +size : 12,
        sort: sort ?? 'createdAt,desc',
        minPrice: minPrice ? +minPrice : undefined,
        maxPrice: maxPrice ? +maxPrice : undefined,
        minRating: minRating ? +minRating : undefined,
      };

      // Chỉ set searchParams nếu nó thực sự thay đổi
      if (JSON.stringify(this.searchParams()) !== JSON.stringify(newSearchParams)) {
        this.searchParams.set(newSearchParams);
      } else if (!this.products().length && !this.errorMessage() && Object.keys(this.searchParams()).length > 0 && !this.isLoading()) {
        this.loadProducts(this.searchParams());
      }

      this.filterForm.patchValue({
        keyword: keyword ?? '',
        minPrice: minPrice ? +minPrice : null,
        maxPrice: maxPrice ? +maxPrice : null,
        minRating: minRating ? +minRating : 0,
      }, { emitEvent: false });

      if (!slug && !keyword && !minPrice && !maxPrice && !minRating && Object.keys(this.searchParams()).length === 0) {
        this.isLoading.set(false);
      }

    });

    // Lắng nghe thay đổi của filterForm, nhưng không tự động điều hướng ngay
    // Thay vào đó, người dùng sẽ nhấn nút "Áp dụng bộ lọc" hoặc "Tìm trên tất cả"
    // Bỏ hoặc comment out valueChanges nếu muốn kiểm soát hoàn toàn bằng nút bấm
    this.filterForm.valueChanges.pipe(
      debounceTime(400),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
      takeUntil(this.destroy$)
    ).subscribe(formValue => {
      // Không làm gì ở đây, để nút bấm xử lý
    });
  }

  // Custom validator cho khoảng giá
  priceRangeValidator(form: any) { // Sử dụng any để tránh lỗi type với AbstractControl
    const minPrice = form.get('minPrice')?.value;
    const maxPrice = form.get('maxPrice')?.value;
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
      return { invalidPriceRange: true };
    }
    return null;
  }

  loadCategoryInfo(slug: string): void {
    this.categoryService.getCategoryBySlug(slug).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.currentCategory.set(res.data);
          // Sau khi có categoryId, cập nhật lại searchParams để load product
          this.searchParams.update(current => ({ ...current, categoryId: res.data?.id ?? null, page: 0 }));
        } else {
          this.currentCategory.set(null);
          this.errorMessage.set(`Không tìm thấy danh mục: ${slug}`);
          this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 })); // Vẫn load sản phẩm không lọc category
        }
      },
      error: (err) => {
        this.currentCategory.set(null);
        this.errorMessage.set(`Lỗi khi tải danh mục: ${slug}`);
        this.searchParams.update(current => ({ ...current, categoryId: null, page: 0 }));
        this.isLoading.set(false); // Hoàn tất loading nếu có lỗi ở đây
      }
    });
  }

  loadProducts(params: ProductSearchParams): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Chuẩn bị params để gửi đi, loại bỏ các giá trị null/undefined/empty string/0 cho minRating
    const apiParams: ProductSearchParams = { ...params };
    if (!apiParams.keyword?.trim()) delete apiParams.keyword;
    if (apiParams.minPrice === null || apiParams.minPrice === undefined) delete apiParams.minPrice;
    if (apiParams.maxPrice === null || apiParams.maxPrice === undefined) delete apiParams.maxPrice;
    if (apiParams.minRating === null || apiParams.minRating === undefined || apiParams.minRating === 0) {
      delete apiParams.minRating; // API nên hiểu là không lọc nếu không có minRating
    }

    // Đảm bảo page và size luôn có giá trị hợp lệ
    apiParams.page = params.page ?? 0;
    apiParams.size = params.size ?? 12;


    this.productService.searchPublicProducts(apiParams).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.products.set(response.data.content);
          this.paginationData.set(response.data);
        } else {
          this.products.set([]);
          this.paginationData.set(null);
          this.errorMessage.set(response.message || 'Không tìm thấy sản phẩm nào.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.products.set([]);
        this.paginationData.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi tải sản phẩm.');
        this.isLoading.set(false);
      }
    });
  }


  onPageChange(page: number): void {
    // Khi page thay đổi, chỉ cần cập nhật queryParam 'page' trên URL
    // ngOnInit sẽ lắng nghe thay đổi này và cập nhật searchParams, sau đó effect sẽ load lại
    const queryParams: NavigationExtras = { queryParams: { page: page }, queryParamsHandling: 'merge' };
    this.router.navigate([], { relativeTo: this.route, ...queryParams, replaceUrl: true });
  }


  private updateUrlQueryParamsFromForm(formValue: any): void {
    const queryParams: any = {};

    if (formValue.keyword?.trim()) queryParams.keyword = formValue.keyword.trim();
    if (formValue.minPrice !== null && formValue.minPrice !== undefined) queryParams.minPrice = formValue.minPrice;
    if (formValue.maxPrice !== null && formValue.maxPrice !== undefined) queryParams.maxPrice = formValue.maxPrice;
    if (formValue.minRating !== null && formValue.minRating !== undefined && formValue.minRating > 0) {
      queryParams.minRating = formValue.minRating;
    }
    // Khi filter từ form, luôn reset về trang 0
    queryParams.page = null; // Đặt là null để xóa 'page' khỏi URL, ngOnInit sẽ mặc định là 0

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queryParams,
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }



// Hàm này sẽ được gọi bởi các nút bấm
  applyFilters(searchInAll: boolean = false): void {
    if (this.filterForm.valid) {
      const formValue = this.filterForm.value;
      const queryParams: any = {};

      if (formValue.keyword?.trim()) queryParams.keyword = formValue.keyword.trim();
      if (formValue.minPrice !== null && formValue.minPrice !== undefined) queryParams.minPrice = formValue.minPrice;
      if (formValue.maxPrice !== null && formValue.maxPrice !== undefined) queryParams.maxPrice = formValue.maxPrice;
      if (formValue.minRating !== null && formValue.minRating !== undefined && formValue.minRating > 0) {
        queryParams.minRating = formValue.minRating;
      }
      queryParams.page = null; // Reset về trang đầu khi áp dụng filter mới

      let targetPathArray: string[];
      const currentSlug = this.route.snapshot.paramMap.get('slug');

      if (searchInAll || !currentSlug) {
        targetPathArray = ['/products'];
      } else {
        targetPathArray = ['/categories', currentSlug];
      }

      this.router.navigate(targetPathArray, {
        queryParams: queryParams,
        // queryParamsHandling: 'merge', // Ghi đè các query params filter hiện tại
        replaceUrl: true
      });
    } else {
      console.log("Filter form is invalid");
    }
  }


  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
  // Thêm hàm reset bộ lọc (ví dụ)
  resetFilters(): void {
    const currentSlug = this.route.snapshot.paramMap.get('slug');
    this.filterForm.reset({
      keyword: '',
      minPrice: null,
      maxPrice: null,
      minRating: 0
    }, { emitEvent: false }); // Không emit valueChanges

    const targetPath = currentSlug ? ['/categories', currentSlug] : ['/products'];
    this.router.navigate(targetPath, { queryParams: {}, replaceUrl: true });
  }

}
