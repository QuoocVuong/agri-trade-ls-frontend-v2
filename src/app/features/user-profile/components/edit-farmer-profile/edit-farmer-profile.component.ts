import {Component, OnInit, inject, signal, computed} from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FarmerProfileRequest } from '../../dto/request/FarmerProfileRequest';
import { FarmerProfileResponse } from '../../dto/response/FarmerProfileResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import {District, LocationService, Province, Ward} from '../../../../core/services/location.service';
import {firstValueFrom, Observable, of, Subject} from 'rxjs';
import {filter, takeUntil, tap} from 'rxjs/operators';
// Import AlertComponent nếu có
// import { AlertComponent } from '../../../../shared/components/alert/alert.component';
// @ts-ignore
//import { Slugify } from 'diacritic-slugify';
import {ToastrService} from 'ngx-toastr';
//mport slugify from 'slug';

@Component({
  selector: 'app-edit-farmer-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink /*, AlertComponent */],
  templateUrl: './edit-farmer-profile.component.html',
})
export class EditFarmerProfileComponent implements OnInit {
  private fb = inject(FormBuilder);
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private locationService = inject(LocationService);
  //private slugify = new slug();
  private destroy$ = new Subject<void>();
  private toastr = inject(ToastrService);

  profileForm!: FormGroup;
  isLoading = signal(false);
  isFetching = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  currentProfile = signal<FarmerProfileResponse | null>(null);
  isEditMode = computed(() => !!this.currentProfile()); // Xác định là đang sửa hay tạo mới

  // TODO: Lấy danh sách huyện/xã của Lạng Sơn từ service hoặc dữ liệu tĩnh
  districts = signal<any[]>([ { code: '121', name: 'Huyện A (LS)' }, { code: '122', name: 'Huyện B (LS)' } ]); // Dữ liệu giả
  wards = signal<any[]>([]); // Sẽ load khi chọn huyện
  // Signals và Observables cho địa giới
  // Không cần signal cho province vì chỉ có Lạng Sơn
  districts$: Observable<District[]> = of([]);
  wards$: Observable<Ward[]> = of([]);
  provinces$: Observable<Province[]> = of([]); // *** Load danh sách tỉnh ***


  ngOnInit(): void {
    this.initForm();
    this.loadCurrentProfile();
    this.provinces$ = this.locationService.getProvinces(); // *** Load tỉnh khi init ***
    this.setupLocationListeners(); // *** Gọi hàm lắng nghe thay đổi địa giới ***





    // Lắng nghe sự thay đổi của huyện để load xã (provinceCode đã disable)
    this.profileForm.get('districtCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(districtCode => {
        this.profileForm.get('wardCode')?.reset(null);
        this.profileForm.get('wardCode')?.disable();
        this.wards$ = of([]);
        if (districtCode) {
          this.loadWards(districtCode); // Gọi hàm load xã
          this.profileForm.get('wardCode')?.enable();
        }
      });
  }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  private initForm(): void {
    this.profileForm = this.fb.group({
      farmName: ['', [Validators.required, Validators.maxLength(255)]],
      description: [''],
      //name: ['', Validators.required],
      slug: [''],
      addressDetail: ['', Validators.maxLength(255)],
      // provinceCode: [{ value: '12', disabled: true }, Validators.required], // Disable tỉnh Lạng Sơn
      // *** Bỏ disable, cho phép chọn tỉnh ***
      provinceCode: [null, Validators.required],

      districtCode: [{ value: null, disabled: true }, [Validators.required, Validators.maxLength(10)]], // Disable ban đầu
      wardCode: [{ value: null, disabled: true }, [Validators.required, Validators.maxLength(10)]], // Disable ban đầu
      coverImageUrl: ['', Validators.maxLength(512)],
      canSupplyB2b: [false, Validators.required],
      b2bCertifications: [''],
      minB2bOrderValue: [null, [Validators.min(0)]]
    });

    // Lắng nghe b2bEnabled để enable/disable các trường liên quan
    this.profileForm.get('b2bEnabled')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAvailable => { /* ... (logic như cũ) ... */ });
  }


  // private async loadCurrentProfile(): Promise<void> { // Dùng async/await
  //   this.isFetching.set(true);
  //   this.errorMessage.set(null);
  //   try {
  //     const response = await firstValueFrom(this.userProfileService.getMyProfile().pipe(takeUntil(this.destroy$))); // Chờ lấy profile
  //
  //     if (response.success && response.data?.farmerProfile) {
  //       const farmerProfile = response.data.farmerProfile;
  //       this.currentProfile.set(farmerProfile);
  //       // Patch các giá trị không phải địa giới trước
  //       this.profileForm.patchValue({
  //         farmName: farmerProfile.farmName,
  //         description: farmerProfile.description,
  //         addressDetail: farmerProfile.addressDetail,
  //         provinceCode: farmerProfile.provinceCode, // Vẫn patch dù disable
  //         coverImageUrl: farmerProfile.coverImageUrl,
  //         canSupplyB2b: farmerProfile.canSupplyB2b,
  //         b2bCertifications: farmerProfile.b2bCertifications,
  //         minB2bOrderValue: farmerProfile.minB2bOrderValue
  //       }, { emitEvent: false }); // Không trigger valueChanges
  //
  //       // Load huyện dựa trên provinceCode đã patch
  //       if (farmerProfile.provinceCode) {
  //         await this.loadDistricts(farmerProfile.provinceCode); // Chờ load huyện
  //         // Patch districtCode sau khi danh sách huyện đã có
  //         if (farmerProfile.districtCode) {
  //           this.profileForm.patchValue({ districtCode: farmerProfile.districtCode }, { emitEvent: false });
  //           // Load xã dựa trên districtCode đã patch
  //           await this.loadWards(farmerProfile.districtCode); // Chờ load xã
  //           // Patch wardCode sau khi danh sách xã đã có
  //           if (farmerProfile.wardCode) {
  //             this.profileForm.patchValue({ wardCode: farmerProfile.wardCode }, { emitEvent: false });
  //           }
  //         }
  //       }
  //       // Trigger B2B enable/disable check
  //       this.profileForm.get('b2bEnabled')?.updateValueAndValidity();
  //       this.profileForm.markAsPristine(); // Đánh dấu chưa sửa đổi
  //
  //     } else if (response.success && !response.data?.farmerProfile) {
  //       this.currentProfile.set(null); // Chưa có profile -> form trống
  //       // Nếu là form tạo mới, vẫn cần load huyện cho tỉnh Lạng Sơn
  //       await this.loadDistricts('12'); // Load huyện cho Lạng Sơn
  //     } else {
  //       this.handleErrorAndNavigate(response.message || 'Không thể tải hồ sơ nông dân.');
  //     }
  //   } catch (err: any) {
  //     this.handleErrorAndNavigate(err.message || 'Lỗi khi tải hồ sơ.');
  //   } finally {
  //     this.isFetching.set(false);
  //   }
  // }

  private async loadCurrentProfile(): Promise<void> {
    this.isFetching.set(true);
    this.errorMessage.set(null);
    try {
      // Chờ load tỉnh xong trước khi lấy profile (để dropdown tỉnh có dữ liệu)
      await firstValueFrom(this.provinces$.pipe(takeUntil(this.destroy$)));

      const response = await firstValueFrom(this.userProfileService.getMyProfile().pipe(takeUntil(this.destroy$)));

      if (response.success && response.data?.farmerProfile) {
        const farmerProfile = response.data.farmerProfile;
        this.currentProfile.set(farmerProfile);

        // Patch các giá trị không phải địa giới trước
        this.profileForm.patchValue({
          farmName: farmerProfile.farmName,
          description: farmerProfile.description,
          addressDetail: farmerProfile.addressDetail,
          // provinceCode sẽ được patch sau khi load huyện/xã xong để trigger đúng
          coverImageUrl: farmerProfile.coverImageUrl,
          canSupplyB2b: farmerProfile.canSupplyB2b,
          b2bCertifications: farmerProfile.b2bCertifications,
          minB2bOrderValue: farmerProfile.minB2bOrderValue
        }, { emitEvent: false });

        // Patch và load địa giới tuần tự
        if (farmerProfile.provinceCode) {
          this.profileForm.get('provinceCode')?.setValue(farmerProfile.provinceCode, { emitEvent: true }); // Trigger load huyện
          // Chờ huyện load xong (valueChanges sẽ trigger loadWards)
          await firstValueFrom(this.districts$.pipe(filter(d => d.length > 0), takeUntil(this.destroy$))); // Chờ districts$ có dữ liệu
          if (farmerProfile.districtCode) {
            this.profileForm.get('districtCode')?.setValue(farmerProfile.districtCode, { emitEvent: true }); // Trigger load xã
            await firstValueFrom(this.wards$.pipe(filter(w => w.length > 0), takeUntil(this.destroy$))); // Chờ wards$ có dữ liệu
            if (farmerProfile.wardCode) {
              this.profileForm.get('wardCode')?.setValue(farmerProfile.wardCode, { emitEvent: false });
            }
          }
        }
        this.profileForm.get('b2bEnabled')?.updateValueAndValidity();
        this.profileForm.markAsPristine();

      } else if (response.success && !response.data?.farmerProfile) {
        this.currentProfile.set(null); // Chưa có profile
        // Enable các control địa giới nếu cần
        this.profileForm.get('districtCode')?.disable({ emitEvent: false });
        this.profileForm.get('wardCode')?.disable({ emitEvent: false });
      } else {
        this.handleErrorAndNavigate(response.message || 'Không thể tải hồ sơ nông dân.');
      }
    } catch (err: any) {
      this.handleErrorAndNavigate(err.message || 'Lỗi khi tải hồ sơ.');
    } finally {
      this.isFetching.set(false);
    }
  }

  // Hàm load huyện (được gọi bởi valueChanges của tỉnh)
  private loadDistricts(provinceCode: string): void {
    console.log("Loading districts for province:", provinceCode);
    this.districts$ = this.locationService.getDistricts(provinceCode).pipe(
      tap(() => this.profileForm.get('districtCode')?.enable({ emitEvent: false })) // Enable sau khi có data
    );
    // Không cần await ở đây nữa vì valueChanges của district sẽ tự trigger loadWards
  }


  // Hàm load xã (được gọi bởi valueChanges của huyện)
  private loadWards(districtCode: string): void {
    console.log("Loading wards for district:", districtCode);
    this.wards$ = this.locationService.getWards(districtCode).pipe(
      tap(() => this.profileForm.get('wardCode')?.enable({ emitEvent: false })) // Enable sau khi có data
    );
    // Không cần await ở đây
  }
  onSubmit(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.toastr.warning('Vui lòng kiểm tra lại các trường thông tin bắt buộc.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const requestData: FarmerProfileRequest = this.profileForm.getRawValue(); // Lấy cả giá trị disable

    this.userProfileService.createOrUpdateFarmerProfile(requestData).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          const message = this.isEditMode() ? 'Cập nhật hồ sơ nông dân thành công!' : 'Đăng ký hồ sơ nông dân thành công! Hồ sơ đang chờ duyệt.';
          this.successMessage.set(message);
          this.toastr.success(message);
          this.currentProfile.set(response.data);
          // Patch lại form để cập nhật giá trị mới nhất (nếu backend có thay đổi) và reset trạng thái dirty
          this.profileForm.patchValue(response.data);
          this.profileForm.markAsPristine();
          // Cập nhật lại user nếu là lần đầu tạo profile
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
    // Có thể điều hướng về trang profile chính
    // this.router.navigate(['/user/profile']);
  }
  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    this.isFetching.set(false);
    console.error(err);
  }

  // *** Hàm mới để lắng nghe thay đổi địa giới ***
  private setupLocationListeners(): void {
    const provinceControl = this.profileForm.get('provinceCode');
    const districtControl = this.profileForm.get('districtCode');
    const wardControl = this.profileForm.get('wardCode');

    if (!provinceControl || !districtControl || !wardControl) return;

    // Lắng nghe sự thay đổi của tỉnh
    // Lắng nghe sự thay đổi của tỉnh
    provinceControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        tap(provinceCode => { // Reset và disable trước khi load
          districtControl.reset(null, { emitEvent: false });
          districtControl.disable({ emitEvent: false });
          wardControl.reset(null, { emitEvent: false });
          wardControl.disable({ emitEvent: false });
          this.districts$ = of([]);
          this.wards$ = of([]);
        }),
        filter(provinceCode => !!provinceCode) // Chỉ xử lý nếu có giá trị tỉnh
      )
      .subscribe(provinceCode => {
        this.loadDistricts(provinceCode); // Load huyện
      });

    // Lắng nghe sự thay đổi của huyện
    districtControl.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        tap(districtCode => { // Reset và disable trước khi load
          wardControl.reset(null, { emitEvent: false });
          wardControl.disable({ emitEvent: false });
          this.wards$ = of([]);
        }),
        filter(districtCode => !!districtCode) // Chỉ xử lý nếu có giá trị huyện
      )
      .subscribe(districtCode => {
        this.loadWards(districtCode); // Load xã
      });


    // Lắng nghe b2bEnabled (chuyển từ initForm ra đây)
    this.profileForm.get('b2bEnabled')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(isAvailable => { /* ... (logic enable/disable trường B2B như cũ) ... */ });
  }




}
