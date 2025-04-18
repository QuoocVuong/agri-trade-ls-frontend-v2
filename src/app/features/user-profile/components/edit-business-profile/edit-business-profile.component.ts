import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { BusinessProfileRequest } from '../../dto/request/BusinessProfileRequest';
import { BusinessProfileResponse } from '../../dto/response/BusinessProfileResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { Subject, Observable, of, firstValueFrom } from 'rxjs';
import { takeUntil, finalize, debounceTime, distinctUntilChanged, filter, tap } from 'rxjs/operators';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service'; // Import LocationService

@Component({
  selector: 'app-edit-business-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent],
  templateUrl: './edit-business-profile.component.html',
})
export class EditBusinessProfileComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService);
  private locationService = inject(LocationService); // Inject LocationService
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();

  profileForm!: FormGroup;
  isLoading = signal(false);
  isFetching = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  currentProfile = signal<BusinessProfileResponse | null>(null);
  isEditMode = computed(() => !!this.currentProfile());

  // Observables cho địa giới
  provinces$: Observable<Province[]> = of([]); // *** Thêm provinces$ ***
  districts$: Observable<District[]> = of([]);
  wards$: Observable<Ward[]> = of([]);

  ngOnInit(): void {
    this.initForm();
    this.provinces$ = this.locationService.getProvinces(); // *** Load tỉnh khi init ***
    this.loadCurrentProfile();
    this.setupLocationListeners(); // *** Gọi hàm lắng nghe ***
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initForm(): void {
    this.profileForm = this.fb.group({
      businessName: ['', [Validators.required, Validators.maxLength(255)]],
      taxCode: ['', [Validators.maxLength(20)]],
      industry: ['', [Validators.maxLength(100)]],
      businessPhone: ['', [Validators.maxLength(20)]],
      businessAddressDetail: ['', Validators.maxLength(255)],
      // *** Cho phép chọn tỉnh, bắt đầu là null ***
      businessProvinceCode: [null, Validators.required],
      businessDistrictCode: [{ value: null, disabled: true }, Validators.required],
      businessWardCode: [{ value: null, disabled: true }, Validators.required],
      contactPerson: ['', Validators.maxLength(100)]
    });
  }

  // *** Hàm lắng nghe thay đổi địa giới (giống Farmer) ***
  private setupLocationListeners(): void {
    const provinceControl = this.profileForm.get('businessProvinceCode');
    const districtControl = this.profileForm.get('businessDistrictCode');
    const wardControl = this.profileForm.get('businessWardCode');

    if (!provinceControl || !districtControl || !wardControl) return;

    provinceControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(provinceCode => {
        districtControl.reset(null, { emitEvent: false });
        districtControl.disable({ emitEvent: false });
        wardControl.reset(null, { emitEvent: false });
        wardControl.disable({ emitEvent: false });
        this.districts$ = of([]);
        this.wards$ = of([]);
        if (provinceCode) {
          this.loadDistricts(provinceCode);
        }
      });

    districtControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(districtCode => {
        wardControl.reset(null, { emitEvent: false });
        wardControl.disable({ emitEvent: false });
        this.wards$ = of([]);
        if (districtCode) {
          this.loadWards(districtCode);
        }
      });
  }


  private async loadCurrentProfile(): Promise<void> {
    this.isFetching.set(true);
    this.errorMessage.set(null);
    try {
      await firstValueFrom(this.provinces$.pipe(takeUntil(this.destroy$))); // Chờ load tỉnh

      const response = await firstValueFrom(this.userProfileService.getMyProfile().pipe(takeUntil(this.destroy$)));

      if (response.success && response.data?.businessProfile) {
        const businessProfile = response.data.businessProfile;
        this.currentProfile.set(businessProfile);

        this.profileForm.patchValue({
          businessName: businessProfile.businessName,
          taxCode: businessProfile.taxCode,
          industry: businessProfile.industry,
          businessPhone: businessProfile.businessPhone,
          businessAddressDetail: businessProfile.businessAddressDetail,
          // provinceCode sẽ patch sau
          contactPerson: businessProfile.contactPerson
        }, { emitEvent: false });

        // Patch và load địa giới tuần tự
        if (businessProfile.businessProvinceCode) {
          this.profileForm.get('businessProvinceCode')?.setValue(businessProfile.businessProvinceCode, { emitEvent: true }); // Trigger load huyện
          await firstValueFrom(this.districts$.pipe(filter(d=>d.length > 0), takeUntil(this.destroy$)));
          if (businessProfile.districtCode) {
            this.profileForm.get('businessDistrictCode')?.setValue(businessProfile.districtCode, { emitEvent: true }); // Trigger load xã
            await firstValueFrom(this.wards$.pipe(filter(w=>w.length > 0), takeUntil(this.destroy$)));
            if (businessProfile.wardCode) {
              this.profileForm.get('businessWardCode')?.setValue(businessProfile.wardCode, { emitEvent: false });
            }
          }
        }
        this.profileForm.markAsPristine();

      } else {
        this.currentProfile.set(null); // Tạo mới
        // Enable các control địa giới
        this.profileForm.get('businessProvinceCode')?.enable({ emitEvent: false });
        this.profileForm.get('businessDistrictCode')?.disable({ emitEvent: false }); // Vẫn disable ban đầu
        this.profileForm.get('businessWardCode')?.disable({ emitEvent: false });
      }
    } catch (err: any) {
      this.handleErrorAndNavigate(err.message || 'Lỗi khi tải hồ sơ.');
    } finally {
      this.isFetching.set(false);
    }
  }

  // --- Logic load địa giới hành chính (Giống Farmer) ---
  private async loadDistricts(provinceCode: string): Promise<void> {
    this.districts$ = this.locationService.getDistricts(provinceCode).pipe(
      tap(() => this.profileForm.get('businessDistrictCode')?.enable({ emitEvent: false }))
    );
    try { await firstValueFrom(this.districts$); } catch (e) { console.error("Error loading districts", e); }
  }

  private async loadWards(districtCode: string): Promise<void> {
    this.wards$ = this.locationService.getWards(districtCode).pipe(
      tap(() => this.profileForm.get('businessWardCode')?.enable({ emitEvent: false }))
    );
    try { await firstValueFrom(this.wards$); } catch (e) { console.error("Error loading wards", e); }
  }


  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toastr.warning('Vui lòng kiểm tra lại các trường thông tin bắt buộc.');
      return;
    }

    // *** Bỏ kiểm tra cứng tỉnh Lạng Sơn ở đây ***
    // const requestData: BusinessProfileRequest = this.profileForm.getRawValue();
    // if (requestData.businessProvinceCode !== '12') { ... }


    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const requestData: BusinessProfileRequest = this.profileForm.getRawValue();

    this.userProfileService.createOrUpdateBusinessProfile(requestData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const message = this.isEditMode() ? 'Cập nhật hồ sơ doanh nghiệp thành công!' : 'Đăng ký hồ sơ doanh nghiệp thành công!';
          this.successMessage.set(message);
          this.toastr.success(message);
          this.currentProfile.set(response.data);
          // Patch lại form với dữ liệu trả về
          this.profileForm.patchValue({
            businessName: response.data.businessName,
            taxCode: response.data.taxCode,
            industry: response.data.industry,
            businessPhone: response.data.businessPhone,
            businessAddressDetail: response.data.businessAddressDetail,
            businessProvinceCode: response.data.businessProvinceCode,
            businessDistrictCode: response.data.districtCode,
            businessWardCode: response.data.wardCode,
            contactPerson: response.data.contactPerson
          });
          this.profileForm.markAsPristine();
          if (!this.isEditMode()) {
            this.authService.refreshUserProfile().subscribe();
          }
        } else {
          this.handleError(response, 'Lưu hồ sơ thất bại.');
        }
        this.isLoading.set(false);
      },
      error: (err) => this.handleError(err, 'Lỗi khi lưu hồ sơ.')
    });
  }

  // Helper xử lý lỗi và điều hướng
  private handleErrorAndNavigate(message: string): void {
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isFetching.set(false);
  }
  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isFetching.set(false); // Tắt cả fetching
    console.error(err);
  }
}
