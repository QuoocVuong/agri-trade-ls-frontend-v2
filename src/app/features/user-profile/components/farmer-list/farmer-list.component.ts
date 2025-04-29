

import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common'; // Import DatePipe nếu cần
import { Router, RouterLink, ActivatedRoute } from '@angular/router'; // Import ActivatedRoute nếu cần đọc queryParams
import {Observable, of, Subject} from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Page } from '../../../../core/models/page.model';
import { ApiResponse, PagedApiResponse } from '../../../../core/models/api-response.model';
import { FarmerSummaryResponse } from '../../dto/response/FarmerSummaryResponse'; // DTO tóm tắt Farmer
import { FarmerService } from '../../services/farmer.service'; // Service gọi API Farmer
import { LocationService, Province } from '../../../../core/services/location.service'; // Service địa điểm
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms'; // Import Forms

@Component({
  selector: 'app-farmer-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule, // Thêm ReactiveFormsModule
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe, // Thêm nếu dùng pipe date

  ],
  templateUrl: './farmer-list.component.html',
})
export class FarmerListComponent implements OnInit, OnDestroy {
  private farmerService = inject(FarmerService);
  private locationService = inject(LocationService);
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute); // Inject nếu cần đọc queryParams
  private router = inject(Router); // Inject nếu cần navigate khi filter
  private destroy$ = new Subject<void>();

  farmersPage = signal<Page<FarmerSummaryResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  provinces = signal<Province[]>([]); // Danh sách tỉnh để lọc

  // Filter form
  // *** SỬA FILTER FORM ***
  filterForm = this.fb.group({
    keyword: [''],
    provinceCode: [''],
    sort: ['farmName,asc'] // <-- Thêm sort vào form, đặt giá trị mặc định
  });
  // **********************

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(12); // Số lượng farmer mỗi trang
  //sort = signal('farmName,asc'); // Ví dụ: Sắp xếp theo tên trang trại

  ngOnInit(): void {
    this.loadProvinces(); // Load tỉnh cho bộ lọc
    this.loadFarmers(); // Load danh sách farmer ban đầu

    // Lắng nghe thay đổi filter để load lại
    this.filterForm.valueChanges.pipe(
      debounceTime(500),
      distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)), // So sánh sâu hơn
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.currentPage.set(0); // Reset về trang đầu khi filter
      this.loadFarmers();
    });

    // (Tùy chọn) Lắng nghe queryParams nếu muốn link từ nơi khác có sẵn filter
    // this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
    //   const province = params['province'];
    //   if (province) {
    //     this.filterForm.patchValue({ provinceCode: province }, { emitEvent: false });
    //   }
    //   this.loadFarmers(); // Load lại khi queryParams thay đổi
    // });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProvinces(): void {
    this.locationService.getProvinces()
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.provinces.set(data));
  }

  loadFarmers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const formValue = this.filterForm.value;
    const params = {
      page: this.currentPage(),
      size: this.pageSize(),
      sort: formValue.sort || 'farmName,asc', // Lấy sort từ form hoặc dùng default
      keyword: formValue.keyword || undefined,
      provinceCode: formValue.provinceCode || undefined
    };

    // Gọi service để lấy danh sách farmer (cần có hàm này trong FarmerService)
    this.farmerService.searchPublicFarmers(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.farmersPage.set(res.data);
          } else {
            this.farmersPage.set(null);
            // Chỉ hiển thị lỗi nếu không phải 404 (404 nghĩa là không tìm thấy)
            if(res.status !== 404 && !res.success) {
              this.errorMessage.set(res.message || 'Không tải được danh sách nhà bán.');
            }
          }
          this.isLoading.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.message || 'Lỗi khi tải danh sách nhà bán.');
          this.farmersPage.set(null);
          this.isLoading.set(false);
          console.error(err);
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadFarmers();
  }

  // Hàm helper để lấy tên hiển thị
  getFarmerDisplayName(farmer: FarmerSummaryResponse | null): string {
    if (!farmer) return 'Nông dân';
    return farmer.farmName || farmer.fullName || 'Nông dân';
  }

  // Hàm lấy tên tỉnh (có thể copy từ component khác hoặc tạo service chung)
  getProvinceName(code: string | null | undefined): Observable<string | null> {
    if (!code) return of(null);
    // Giả sử LocationService đã được inject và có hàm findProvinceName
    return this.locationService.findProvinceName(code);
  }


  trackFarmerById(index: number, item: FarmerSummaryResponse): number {
    return item.userId;
  }
}
