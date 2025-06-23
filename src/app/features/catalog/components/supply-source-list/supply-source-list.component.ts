// src/app/features/catalog/components/supply-source-list/supply-source-list.component.ts
import {Component, OnInit, inject, signal, OnDestroy, effect, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink, NavigationExtras } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Subject, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil, tap } from 'rxjs/operators';

import { ProductService, SupplySourceSearchParams } from '../../services/product.service';
import { CategoryService } from '../../services/category.service';
import { SupplySourceResponse } from '../../dto/response/SupplySourceResponse';
import { CategoryResponse } from '../../dto/response/CategoryResponse';
import { PageData, ApiResponse } from '../../../../core/models/api-response.model';

import { SupplySourceCardComponent } from '../supply-source-card/supply-source-card.component';
import { CategorySidebarComponent } from '../category-sidebar/category-sidebar.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import {District, LocationService, Province, Ward} from '../../../../core/services/location.service';

@Component({
  selector: 'app-supply-source-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    SupplySourceCardComponent,
    CategorySidebarComponent,
    PaginatorComponent,
    LoadingSpinnerComponent,
    AlertComponent
  ],
  templateUrl: './supply-source-list.component.html',

})
export class SupplySourceListComponent implements OnInit, OnDestroy {
  private productService = inject(ProductService);
  private categoryService = inject(CategoryService);
  public route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  private locationService = inject(LocationService);
  private cdr = inject(ChangeDetectorRef);


  supplySources = signal<SupplySourceResponse[]>([]);
  paginationData = signal<PageData<SupplySourceResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  currentCategoryContext = signal<CategoryResponse | null>(null);
  // Signals cho danh sách địa phương
  provinces = signal<Province[]>([]);
  districts = signal<District[]>([]);
  wards = signal<Ward[]>([]); // Signal cho xã

  filterForm = this.fb.group({
    productKeyword: [''], // Đổi tên từ keyword để rõ ràng hơn
    provinceCode: [''],
    districtCode: [''],
    wardCode: [''],
    minQuantityNeeded: [null as number | null, [Validators.min(0)]]
    // Thêm các control khác nếu cần (ví dụ: categoryId nếu không dùng slug)
  });

  searchParams = signal<SupplySourceSearchParams>({});
  private destroy$ = new Subject<void>();

  constructor() {
    effect(() => {
      const params = this.searchParams();
      if (Object.keys(params).length > 0 && params.hasOwnProperty('page')) {
        this.loadSupplySources(params);
      }
    });
  }

  ngOnInit(): void {

    this.loadInitialLocations(); // Gọi hàm load tỉnh ban đầu

    // Lắng nghe thay đổi của provinceCode để load districts
    this.filterForm.get('provinceCode')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      tap(() => { // Reset huyện và xã khi tỉnh thay đổi
        this.filterForm.get('districtCode')?.setValue('', { emitEvent: false });
        this.filterForm.get('wardCode')?.setValue('', { emitEvent: false });
        this.districts.set([]);
        this.wards.set([]);
      }),
      switchMap(provinceCode => {
        if (provinceCode) {
          return this.locationService.getDistricts(provinceCode);
        }
        return of([]);
      })
    ).subscribe(districts => {
      this.districts.set(districts);
      this.cdr.detectChanges(); // Cần thiết nếu dùng OnPush
    });

    // Lắng nghe thay đổi của districtCode để load wards
    this.filterForm.get('districtCode')?.valueChanges.pipe(
      takeUntil(this.destroy$),
      tap(() => { // Reset xã khi huyện thay đổi
        this.filterForm.get('wardCode')?.setValue('', { emitEvent: false });
        this.wards.set([]);
      }),
      switchMap(districtCode => {
        if (districtCode) {
          return this.locationService.getWards(districtCode);
        }
        return of([]);
      })
    ).subscribe(wards => {
      this.wards.set(wards);
      this.cdr.detectChanges(); // Cần thiết nếu dùng OnPush
    });
    // Logic xử lý route params và queryParams
    combineLatest([
      this.route.paramMap.pipe(map(params => params.get('categorySlug'))), // Nếu bạn muốn lọc nguồn cung theo category slug
      this.route.queryParamMap
    ]).pipe(
      tap(([categorySlug, queryParams]) => {
        this.isLoading.set(true);
        this.errorMessage.set(null);
        const currentSlugInRoute = this.route.snapshot.paramMap.get('categorySlug');
        if (this.currentCategoryContext()?.slug !== currentSlugInRoute || !currentSlugInRoute) {
          this.currentCategoryContext.set(null);
          this.supplySources.set([]);
          this.paginationData.set(null);
        }
      }),
      switchMap(([categorySlug, queryParams]) => {
        if (categorySlug) {
          return this.categoryService.getCategoryBySlug(categorySlug).pipe(
            map(categoryRes => ({ categorySlug, categoryRes, queryParams }))
          );
        }
        return of({ categorySlug: null, categoryRes: null, queryParams });
      }),
      takeUntil(this.destroy$)
    ).subscribe(({ categorySlug, categoryRes, queryParams }) => {
      let categoryIdFromSlug: number | null = null;
      if (categorySlug && categoryRes && categoryRes.success && categoryRes.data) {
        this.currentCategoryContext.set(categoryRes.data);
        categoryIdFromSlug = categoryRes.data.id;
      } else if (categorySlug && (!categoryRes || !categoryRes.success)) {
        this.currentCategoryContext.set(null);
        this.errorMessage.set(`Không tìm thấy danh mục: ${categorySlug}`);
      } else {
        this.currentCategoryContext.set(null);
      }

      const productKeyword = queryParams.get('productKeyword');
      const provinceCode = queryParams.get('provinceCode');
      const districtCode = queryParams.get('districtCode');
      const wardCode = queryParams.get('wardCode');
      const minQuantityNeeded = queryParams.get('minQuantityNeeded');
      const page = queryParams.get('page');
      const size = queryParams.get('size');
      const sort = queryParams.get('sort');

      const newSearchParams: SupplySourceSearchParams = {
        categoryId: categoryIdFromSlug, // Vẫn có thể lọc theo category nếu muốn
        productKeyword: productKeyword ?? undefined,
        provinceCode: provinceCode ?? undefined,
        districtCode: districtCode ?? undefined,
        wardCode: wardCode ?? undefined,
        minQuantityNeeded: minQuantityNeeded ? +minQuantityNeeded : undefined,
        page: page ? +page : 0,
        size: size ? +size : 12, // Hoặc default size khác
        sort: sort ?? 'farmer.farmerProfile.farmName,asc', // Ví dụ sort mặc định
      };

      // Cập nhật searchParams và patchValue cho form
      if (JSON.stringify(this.searchParams()) !== JSON.stringify(newSearchParams)) {
        this.searchParams.set(newSearchParams);
      } else if (!this.supplySources().length && !this.errorMessage() && Object.keys(this.searchParams()).length > 0 && !this.isLoading()) {
        this.loadSupplySources(this.searchParams());
      }


      this.filterForm.patchValue({
        productKeyword: productKeyword ?? '',
        provinceCode: provinceCode ?? '',
        districtCode: districtCode ?? '',
        wardCode: wardCode ?? '',
        minQuantityNeeded: minQuantityNeeded ? +minQuantityNeeded : null,
      }, { emitEvent: false }); // Quan trọng: emitEvent: false để tránh vòng lặp vô hạn với valueChanges

      // Logic load huyện, xã dựa trên provinceCode, districtCode từ queryParams
      if (provinceCode) {
        this.locationService.getDistricts(provinceCode).subscribe(districts => {
          this.districts.set(districts);
          if (districtCode) {
            this.locationService.getWards(districtCode).subscribe(wards => {
              this.wards.set(wards);
              this.cdr.detectChanges();
            });
          } else {
            this.wards.set([]);
            this.cdr.detectChanges();
          }
        });
      } else {
        this.districts.set([]);
        this.wards.set([]);
        this.cdr.detectChanges();
      }


      if (!categorySlug && !productKeyword && !provinceCode && !districtCode && !wardCode && !minQuantityNeeded && Object.keys(this.searchParams()).length === 0) {
        this.isLoading.set(false);
      }
    });
  }

  loadInitialLocations(): void {
    this.locationService.getProvinces().subscribe(provinces => {
      this.provinces.set(provinces);
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSupplySources(params: SupplySourceSearchParams): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const apiParams: SupplySourceSearchParams = { ...params };
    // Loại bỏ các giá trị không hợp lệ trước khi gửi API
    if (!apiParams.productKeyword?.trim()) delete apiParams.productKeyword;
    if (!apiParams.provinceCode?.trim()) delete apiParams.provinceCode;
    if (!apiParams.districtCode?.trim()) delete apiParams.districtCode;
    if (!apiParams.wardCode?.trim()) delete apiParams.wardCode;
    if (apiParams.minQuantityNeeded == null || apiParams.minQuantityNeeded <= 0) {
      delete apiParams.minQuantityNeeded;
    }
    if (apiParams.categoryId == null) delete apiParams.categoryId;

    apiParams.page = params.page ?? 0;
    apiParams.size = params.size ?? 12;

    this.productService.findSupplySources(apiParams).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.supplySources.set(response.data.content);
          this.paginationData.set(response.data);
        } else {
          this.supplySources.set([]);
          this.paginationData.set(null);
          this.errorMessage.set(response.message || 'Không tìm thấy nguồn cung nào.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.supplySources.set([]);
        this.paginationData.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi tải nguồn cung.');
        this.isLoading.set(false);
      }
    });
  }

  applyFilters(searchInAll: boolean = false): void {
    if (this.filterForm.valid) {
      const formValue = this.filterForm.value;
      const queryParams: any = {};

      if (formValue.productKeyword?.trim()) queryParams.productKeyword = formValue.productKeyword.trim();
      if (formValue.provinceCode?.trim()) queryParams.provinceCode = formValue.provinceCode.trim();
      if (formValue.districtCode?.trim()) queryParams.districtCode = formValue.districtCode.trim();
      if (formValue.wardCode?.trim()) queryParams.wardCode = formValue.wardCode.trim();
      if (formValue.minQuantityNeeded != null && formValue.minQuantityNeeded > 0) {
        queryParams.minQuantityNeeded = formValue.minQuantityNeeded;
      }
      queryParams.page = null; // Reset về trang đầu

      let targetPathArray: string[];
      const currentCategorySlug = this.route.snapshot.paramMap.get('categorySlug');

      if (searchInAll || !currentCategorySlug) {
        targetPathArray = ['/supply-sources']; // Route mới cho trang này
        if (currentCategorySlug) queryParams.categoryId = null; // Xóa categoryId nếu tìm trên tất cả
      } else {
        // Nếu đang ở trang category, giữ lại category đó khi lọc
        targetPathArray = ['/supply-sources/category', currentCategorySlug]; // Ví dụ route mới
        // categoryId sẽ được lấy từ slug trong ngOnInit
      }

      this.router.navigate(targetPathArray, {
        queryParams: queryParams,
        replaceUrl: true
      });
    }
  }

  resetFilters(): void {
    const currentCategorySlug = this.route.snapshot.paramMap.get('categorySlug');
    this.filterForm.reset({
      productKeyword: '',
      provinceCode: '',
      districtCode: '',
      wardCode: '',
      minQuantityNeeded: null
    }, { emitEvent: false });
    // Khi reset, cũng nên reset danh sách huyện và xã
    this.districts.set([]);
    this.wards.set([]);

    const targetPath = currentCategorySlug ? ['/supply-sources/category', currentCategorySlug] : ['/supply-sources'];
    this.router.navigate(targetPath, { queryParams: {}, replaceUrl: true });
  }

  onPageChange(page: number): void {
    const queryParams: NavigationExtras = { queryParams: { page: page }, queryParamsHandling: 'merge' };
    this.router.navigate([], { relativeTo: this.route, ...queryParams, replaceUrl: true });
  }

  onSortChange(event: Event): void {
    const selectedSort = (event.target as HTMLSelectElement).value;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: selectedSort, page: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  navigateToCategory(categorySlug: string | null): void {
    if (categorySlug) {
      this.router.navigate(['/supply-sources/category', categorySlug]); // Hoặc route bạn định nghĩa
    } else {
      this.router.navigate(['/supply-sources']); // Về trang nguồn cung chung
    }
  }

  trackSupplySourceById(index: number, item: SupplySourceResponse): number {
    return item.productId; // Hoặc một ID duy nhất từ farmerInfo nếu cần
  }
}
