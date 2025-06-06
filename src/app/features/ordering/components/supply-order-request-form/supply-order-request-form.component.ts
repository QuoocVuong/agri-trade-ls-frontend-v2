// src/app/features/ordering/components/supply-order-request-form/supply-order-request-form.component.ts
import {Component, OnInit, inject, signal, OnDestroy, ChangeDetectorRef, computed} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ValidationErrors,
  ValidatorFn,
  AbstractControl
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {of, Subject} from 'rxjs';
import { takeUntil, finalize, switchMap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { SupplyOrderRequestService } from '../../services/supply-order-request.service';
import { ProductService } from '../../../catalog/services/product.service';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service';
import { AuthService } from '../../../../core/services/auth.service';

import { SupplyOrderPlacementRequest } from '../../dto/request/SupplyOrderPlacementRequest';
import { ProductDetailResponse } from '../../../catalog/dto/response/ProductDetailResponse'; // Dùng để lấy thông tin sản phẩm ban đầu
import { AddressResponse } from '../../../user-profile/dto/response/AddressResponse'; // Để lấy địa chỉ mặc định
import { UserProfileService } from '../../../user-profile/services/user-profile.service'; // Để lấy địa chỉ

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import BigDecimal from 'js-big-decimal';
import {convertPriceToPerKg, convertToKg, getMassUnitText, MassUnit} from '../../../catalog/domain/mass-unit.enum';


// Custom validator function
export function maxQuantityValidator(max: number | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (max === null || max === undefined) {
      return null; // Không có giới hạn max, luôn hợp lệ
    }
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null; // Không validate nếu rỗng (để Validators.required xử lý)
    }
    return +value > max ? { maxQuantityExceeded: { max: max, actual: value } } : null;
  };
}


@Component({
  selector: 'app-supply-order-request-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, LoadingSpinnerComponent, AlertComponent, DatePipe, FormatBigDecimalPipe],
  templateUrl: './supply-order-request-form.component.html',
})
export class SupplyOrderRequestFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supplyRequestService = inject(SupplyOrderRequestService);
  private productService = inject(ProductService); // Để lấy thông tin sản phẩm
  private authService = inject(AuthService);
  private userProfileService = inject(UserProfileService); // Để lấy địa chỉ mặc định
  private locationService = inject(LocationService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  requestForm!: FormGroup;
  isSubmitting = signal(false);
  isLoadingInitialData = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  // Thông tin từ route params/query params
  private targetFarmerId: number | null = null;
  private targetProductId: number | null = null;
  productContext = signal<ProductDetailResponse | null>(null); // Thông tin sản phẩm đang yêu cầu

  currentUser = this.authService.currentUser;

  provinces = signal<Province[]>([]);
  districts = signal<District[]>([]);
  wards = signal<Ward[]>([]);

  // Signal để lưu trữ đơn vị tính của sản phẩm context
  productContextUnit = signal<string | null>(null);
  availableRequestUnits = Object.values(MassUnit); // Đơn vị Buyer có thể chọn
  getUnitText = getMassUnitText;



  // Computed signal để tính tổng tiền dự kiến
  proposedTotalAmount = computed(() => {
    const quantity = this.requestForm.get('requestedQuantity')?.value;
    const pricePerUnit = this.requestForm.get('proposedPricePerUnit')?.value;
    if (quantity && pricePerUnit && quantity > 0 && pricePerUnit > 0) {
      try {
        // Sử dụng js-big-decimal để tính toán chính xác hơn
        const qtyDecimal = new BigDecimal(quantity);
        const priceDecimal = new BigDecimal(pricePerUnit);
        return qtyDecimal.multiply(priceDecimal);
      } catch (e) {
        return null; // Lỗi parse số
      }
    }
    return null;
  });






  proposedTotalAmountInKg = computed(() => {
    const requestedQuantity = this.requestForm.get('requestedQuantity')?.value;
    const requestedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit | null; // Ép kiểu
    const proposedPricePerUnit = this.requestForm.get('proposedPricePerUnit')?.value;

    if (requestedQuantity && requestedUnit && proposedPricePerUnit &&
      requestedQuantity > 0 && proposedPricePerUnit > 0) {
      try {
        const quantityInKg = convertToKg(requestedQuantity, requestedUnit);
        const pricePerKg = convertPriceToPerKg(proposedPricePerUnit, requestedUnit);

        const totalDecimal = new BigDecimal(quantityInKg).multiply(new BigDecimal(pricePerKg));
        return totalDecimal;
      } catch (e) {
        console.error("Error calculating proposed total in KG:", e);
        return null;
      }
    }
    return null;
  });

  constructor() {
    this.requestForm = this.fb.group({
      requestedQuantity: [null, [Validators.required, Validators.min(1)]],
      requestedUnit: [MassUnit.KG,  Validators.required],
      proposedPricePerUnit: [null as number | null, [Validators.min(0)]],
      buyerNotes: ['', Validators.maxLength(1000)],
      // Thông tin giao hàng
      shippingFullName: ['', Validators.maxLength(100)],
      shippingPhoneNumber: ['', [Validators.pattern(/^(\+84|0)\d{9,10}$/)]],
      shippingAddressDetail: ['', Validators.maxLength(255)],
      shippingProvinceCode: [''],
      shippingDistrictCode: [''],
      shippingWardCode: [''],
      expectedDeliveryDate: [null as string | null]
    });
  }

  ngOnInit(): void {
    this.loadInitialLocations();
    this.setupLocationCascades();

    this.route.queryParamMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          this.isLoadingInitialData.set(true);
          const farmerIdParam = params.get('farmerId');
          const productIdParam = params.get('productId'); // Hoặc productSlug nếu bạn dùng slug

          if (!farmerIdParam || !productIdParam) {
            this.errorMessage.set('Thiếu thông tin nông dân hoặc sản phẩm để tạo yêu cầu.');
            this.isLoadingInitialData.set(false);
            this.toastr.error('Không thể tạo yêu cầu, thiếu thông tin.');
            this.router.navigate(['/supply-sources']); // Quay lại trang tìm kiếm
            return of(null);
          }
          this.targetFarmerId = +farmerIdParam;
          this.targetProductId = +productIdParam;

          // Lấy thông tin sản phẩm để hiển thị và điền sẵn đơn vị
          return this.productService.getPublicProductById(this.targetProductId); // Hoặc getBySlug
        })
      )
      .subscribe({
        next: (productRes) => {
          if (productRes && productRes.success && productRes.data) {
            const productData = productRes.data;
            this.productContext.set(productRes.data);

            // Đơn vị yêu cầu có thể mặc định là đơn vị sỉ của sản phẩm hoặc KG
            const defaultUnit = productData.wholesaleUnit as MassUnit || MassUnit.KG;
            // Điền sẵn đơn vị từ sản phẩm
            this.requestForm.patchValue({
              requestedUnit: defaultUnit
            });
            // Lấy địa chỉ mặc định của người mua
            this.loadDefaultShippingAddress();
          } else if (productRes) { // productRes có thể là null từ switchMap
            this.errorMessage.set(productRes.message || 'Không tải được thông tin sản phẩm.');
          }
          this.isLoadingInitialData.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải thông tin ban đầu.');
          this.isLoadingInitialData.set(false);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInitialLocations(): void {
    this.locationService.getProvinces().subscribe(p => this.provinces.set(p));
  }
  setupLocationCascades(): void {
    this.requestForm.get('shippingProvinceCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(provinceCode => {
        this.requestForm.get('shippingDistrictCode')?.setValue('');
        this.requestForm.get('shippingWardCode')?.setValue('');
        this.districts.set([]);
        this.wards.set([]);
        if (provinceCode) {
          this.locationService.getDistricts(provinceCode).subscribe(d => this.districts.set(d));
        }
      });

    this.requestForm.get('shippingDistrictCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(districtCode => {
        this.requestForm.get('shippingWardCode')?.setValue('');
        this.wards.set([]);
        if (districtCode) {
          this.locationService.getWards(districtCode).subscribe(w => this.wards.set(w));
        }
      });
  }

  loadDefaultShippingAddress(): void {
    const buyer = this.currentUser();
    if (buyer && buyer.id) {
      this.userProfileService.getDefaultAddress(buyer.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(res => {

          if (res.success && res.data) {
            const addressData = res.data;
            this.requestForm.patchValue({
              shippingFullName: res.data.fullName,
              shippingPhoneNumber: res.data.phoneNumber,
              shippingAddressDetail: res.data.addressDetail,
              shippingProvinceCode: res.data.provinceCode,
              // Cần trigger load district/ward
            });

            if (addressData.provinceCode) {
              this.requestForm.get('shippingProvinceCode')?.setValue(addressData.provinceCode, { emitEvent: true }); // emitEvent: true để trigger valueChanges

              // Cách tiếp cận tốt hơn:
              this.locationService.getDistricts(addressData.provinceCode).subscribe(districts => {
                this.districts.set(districts);
                // Chỉ patch districtCode nếu nó có trong danh sách districts vừa load
                if (districts.some(d => d.idDistrict === addressData.districtCode)) {
                  this.requestForm.patchValue({ shippingDistrictCode: addressData.districtCode });

                  if (addressData.districtCode) {
                    this.locationService.getWards(addressData.districtCode).subscribe(wards => {
                      this.wards.set(wards);
                      // Chỉ patch wardCode nếu nó có trong danh sách wards vừa load
                      if (wards.some(w => w.idWard === addressData.wardCode)) {
                        this.requestForm.patchValue({ shippingWardCode: addressData.wardCode });
                      } else {
                        this.requestForm.patchValue({ shippingWardCode: '' }); // Reset nếu không tìm thấy
                      }
                      this.cdr.detectChanges(); // Cập nhật view
                    });
                  } else {
                    this.wards.set([]);
                    this.requestForm.patchValue({ shippingWardCode: '' });
                    this.cdr.detectChanges();
                  }
                } else {
                  this.requestForm.patchValue({ shippingDistrictCode: '', shippingWardCode: '' }); // Reset nếu không tìm thấy
                  this.wards.set([]);
                  this.cdr.detectChanges();
                }
              });
            } else { // Nếu không có provinceCode từ địa chỉ mặc định
              this.districts.set([]);
              this.wards.set([]);
              this.requestForm.patchValue({
                shippingDistrictCode: '',
                shippingWardCode: ''
              });
              this.cdr.detectChanges();
            }

          } else {
            // Nếu không có địa chỉ mặc định, hoặc API lỗi
            console.log('No default address found or API error, patching with buyer info.');
            this.requestForm.patchValue({
              shippingFullName: buyer.fullName,
              shippingPhoneNumber: buyer.phoneNumber,
              // Reset các trường địa chỉ khác
              shippingAddressDetail: '',
              shippingProvinceCode: '',
              shippingDistrictCode: '',
              shippingWardCode: ''
            });
            this.districts.set([]);
            this.wards.set([]);
          }
          this.cdr.detectChanges(); // Cập nhật view sau khi patch
        });
    }
  }
  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    if (this.requestForm.invalid || !this.targetFarmerId || !this.targetProductId) {
      this.requestForm.markAllAsTouched();
      this.toastr.error('Vui lòng điền đầy đủ thông tin yêu cầu.');
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.requestForm.getRawValue(); // Lấy cả trường disabled (requestedUnit)

    const request: SupplyOrderPlacementRequest = {
      farmerId: this.targetFarmerId,
      productId: this.targetProductId,
      requestedQuantity: +formValue.requestedQuantity!,
      requestedUnit: formValue.requestedUnit!,
      proposedPricePerUnit: formValue.proposedPricePerUnit ? formValue.proposedPricePerUnit.toString() : null,
      buyerNotes: formValue.buyerNotes || null,
      shippingFullName: formValue.shippingFullName || null,
      shippingPhoneNumber: formValue.shippingPhoneNumber || null,
      shippingAddressDetail: formValue.shippingAddressDetail || null,
      shippingProvinceCode: formValue.shippingProvinceCode || null,
      shippingDistrictCode: formValue.shippingDistrictCode || null,
      shippingWardCode: formValue.shippingWardCode || null,
      expectedDeliveryDate: formValue.expectedDeliveryDate || null
    };

    this.supplyRequestService.createSupplyOrderRequest(request)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.toastr.success('Yêu cầu đặt hàng của bạn đã được gửi thành công!');
            this.successMessage.set(`Đã gửi yêu cầu cho sản phẩm "${this.productContext()?.name}". Nhà cung cấp sẽ sớm phản hồi.`);
            this.requestForm.reset();
            // Điều hướng đến trang "Yêu cầu đã gửi của tôi"
            this.router.navigate(['/user/my-supply-requests']); // Tạo route này sau
          } else {
            this.errorMessage.set(res.message || 'Gửi yêu cầu thất bại.');
            this.toastr.error(res.message || 'Gửi yêu cầu thất bại.');
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Đã có lỗi xảy ra khi gửi yêu cầu.');
          this.toastr.error(err.error?.message || 'Đã có lỗi xảy ra.');
        }
      });
  }

  protected readonly convertPriceToPerKg = convertPriceToPerKg;
}
