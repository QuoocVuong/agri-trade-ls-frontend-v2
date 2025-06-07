// src/app/features/ordering/components/supply-order-request-form/supply-order-request-form.component.ts
import { Component, OnInit, inject, signal, OnDestroy, ChangeDetectorRef, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  ValidationErrors, // Thêm ValidationErrors
  ValidatorFn,      // Thêm ValidatorFn
  AbstractControl   // Thêm AbstractControl
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {of, Subject, combineLatest, startWith} from 'rxjs'; // Thêm combineLatest
import { takeUntil, finalize, switchMap, distinctUntilChanged, tap } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { SupplyOrderRequestService } from '../../services/supply-order-request.service';
import { ProductService } from '../../../catalog/services/product.service';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service';
import { AuthService } from '../../../../core/services/auth.service';

import { SupplyOrderPlacementRequest } from '../../dto/request/SupplyOrderPlacementRequest';
import { ProductDetailResponse } from '../../../catalog/dto/response/ProductDetailResponse';
import { UserProfileService } from '../../../user-profile/services/user-profile.service';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import BigDecimal from 'js-big-decimal';
import { convertPriceToPerKg, convertToKg, getMassUnitText, MassUnit } from '../../../catalog/domain/mass-unit.enum';

// Custom validator function (đã có từ trước, giữ nguyên)
export function maxQuantityValidator(max: number | null | undefined): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    if (max === null || max === undefined) {
      return null;
    }
    const value = control.value;
    if (value === null || value === undefined || value === '') {
      return null;
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
  // ... (các injects và signals khác giữ nguyên) ...
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private supplyRequestService = inject(SupplyOrderRequestService);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private userProfileService = inject(UserProfileService);
  private locationService = inject(LocationService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);

  requestForm!: FormGroup;
  isSubmitting = signal(false);
  isLoadingInitialData = signal(true);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  private targetFarmerId: number | null = null;
  private targetProductId: number | null = null;
  productContext = signal<ProductDetailResponse | null>(null);
  currentUser = this.authService.currentUser;

  provinces = signal<Province[]>([]);
  districts = signal<District[]>([]);
  wards = signal<Ward[]>([]);

  availableRequestUnits = Object.values(MassUnit);
  getUnitText = getMassUnitText;

  // Computed signal để tính tổng tiền dự kiến (đã có từ trước, giữ nguyên)
  proposedTotalAmountInKg = computed(() => {
    const requestedQuantity = this.requestForm.get('requestedQuantity')?.value;
    const requestedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit | null;
    const proposedPricePerUnit = this.requestForm.get('proposedPricePerUnit')?.value;

    console.log('Calculating total: ', { requestedQuantity, requestedUnit, proposedPricePerUnit });

    // Chỉ tính toán nếu cả số lượng và giá đều có giá trị dương
    if (requestedQuantity != null && requestedUnit && proposedPricePerUnit != null &&
      +requestedQuantity > 0 && +proposedPricePerUnit > 0) { // <<<< THÊM ĐIỀU KIỆN > 0
      try {
        const quantityInKg = convertToKg(requestedQuantity, requestedUnit);
        const pricePerKg = convertPriceToPerKg(proposedPricePerUnit, requestedUnit);

        if (isNaN(quantityInKg) || isNaN(pricePerKg)) {
           console.error("NaN detected in conversion:", { quantityInKg, pricePerKg });
          return null;
        }

        const totalDecimal = new BigDecimal(quantityInKg).multiply(new BigDecimal(pricePerKg));
        console.log('Calculated totalDecimal:', totalDecimal.getValue());
        return totalDecimal;
      } catch (e) {
        console.error("Error calculating proposed total in KG:", e);
        return null;
      }
    }
    console.log('Conditions not met for calculation.');
    return null;
  });

  // Hàm mới để quyết định hiển thị gì cho tổng tiền
  getDisplayProposedTotal(): string {
    const totalKgAmount = this.proposedTotalAmountInKg();
    console.log('getDisplayProposedTotal - totalKgAmount:', totalKgAmount?.getValue());
    if (totalKgAmount !== null) {
      const pipe = new FormatBigDecimalPipe();
      const formatted = pipe.transform(totalKgAmount, '1.0-0'); // Giả sử pipe của bạn trả về string
      return formatted || '---'; // Nếu pipe trả về null/undefined, hiển thị '---'
    }

    // Nếu chưa tính được tổng tiền (do thiếu số lượng hoặc giá)
    const quantity = this.requestForm.get('requestedQuantity')?.value;
    const price = this.requestForm.get('proposedPricePerUnit')?.value;

    if (!quantity && !price) {
      return '---';
    }
    if (!quantity) {
      return 'Vui lòng nhập số lượng';
    }
    if (!price) {
      return 'Vui lòng nhập giá đề xuất';
    }
    return '---'; // Trường hợp khác
  }

  constructor() {
    this.requestForm = this.fb.group({
      requestedQuantity: [null, [Validators.required, Validators.min(1)]], // Validator max sẽ được thêm động
      requestedUnit: [MassUnit.KG, Validators.required],
      proposedPricePerUnit: [null as number | null, [Validators.min(0.01)]],
      buyerNotes: ['', Validators.maxLength(1000)],
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
          const productIdParam = params.get('productId');

          if (!farmerIdParam || !productIdParam) {
            this.errorMessage.set('Thiếu thông tin nông dân hoặc sản phẩm.');
            this.isLoadingInitialData.set(false);
            this.toastr.error('Không thể tạo yêu cầu, thiếu thông tin.');
            this.router.navigate(['/supply-sources']);
            return of(null);
          }
          this.targetFarmerId = +farmerIdParam;
          this.targetProductId = +productIdParam;
          return this.productService.getPublicProductById(this.targetProductId);
        })
      )
      .subscribe({
        next: (productRes) => {
          if (productRes && productRes.success && productRes.data) {
            const productData = productRes.data;
            this.productContext.set(productData);
            const defaultUnit = (productData.wholesaleUnit as MassUnit) || MassUnit.KG;
            this.requestForm.patchValue({ requestedUnit: defaultUnit });
            this.setQuantityValidators(); // <<<< GỌI SET VALIDATOR SAU KHI CÓ productContext
            this.loadDefaultShippingAddress();
          } else if (productRes) {
            this.errorMessage.set(productRes.message || 'Không tải được thông tin sản phẩm.');
          }
          this.isLoadingInitialData.set(false);
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải thông tin ban đầu.');
          this.isLoadingInitialData.set(false);
        }
      });

    // Lắng nghe thay đổi của requestedUnit để cập nhật lại validator cho requestedQuantity
    this.requestForm.get('requestedUnit')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.setQuantityValidators(); // Cập nhật validator khi đơn vị thay đổi
        this.requestForm.get('requestedQuantity')?.updateValueAndValidity(); // Trigger validation lại
      });
  }

  // Hàm set validator động cho requestedQuantity
  private setQuantityValidators(): void {
    const product = this.productContext();
    const quantityControl = this.requestForm.get('requestedQuantity');
    if (!product || !quantityControl) return;

    const stockInBaseUnit = product.stockQuantity;
    const baseUnitOfProduct = product.unit as MassUnit;

    quantityControl.clearValidators();
    quantityControl.setValidators([Validators.required, Validators.min(1)]);

    if (stockInBaseUnit != null && stockInBaseUnit >= 0 && baseUnitOfProduct) {
      const currentRequestedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit;
      if (currentRequestedUnit) {
        try {
          const stockInKg = convertToKg(stockInBaseUnit, baseUnitOfProduct);
          const oneSelectedUnitInKg = convertToKg(1, currentRequestedUnit);

          if (oneSelectedUnitInKg > 0) {
            const maxAllowedRaw = stockInKg / oneSelectedUnitInKg; // Giá trị thô, có thể là thập phân

            if (maxAllowedRaw > 0) {
              // Đối với Validators.max, chúng ta cần một số nguyên nếu input là số nguyên.
              // Nếu bạn cho phép input số thập phân cho số lượng, thì có thể dùng maxAllowedRaw trực tiếp.
              // Hiện tại, input là type="number" nên thường là số nguyên.
              // Validator sẽ kiểm tra giá trị *sau khi* người dùng nhập.
              // Custom validator vẫn là cách tốt nhất để xử lý quy đổi.
              quantityControl.addValidators((control: AbstractControl): ValidationErrors | null => {
                const requestedQtyInput = control.value;
                if (requestedQtyInput == null || requestedQtyInput === '') return null;

                const requestedQtyInSelectedUnit = +requestedQtyInput;
                const selectedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit;

                if (selectedUnit) {
                  try {
                    const requestedQtyInKg = convertToKg(requestedQtyInSelectedUnit, selectedUnit);
                    if (requestedQtyInKg > stockInKg) {
                      return { maxQuantityExceededBase: { maxBase: stockInKg, unitBase: baseUnitOfProduct, requestedBase: requestedQtyInKg } };
                    }
                  } catch (e) {
                    return { invalidUnitConversion: true };
                  }
                }
                return null;
              });
            } else {
              quantityControl.addValidators(Validators.max(0));
            }
          } else {
            quantityControl.addValidators(Validators.max(0));
          }
        } catch (e) {
          console.error("Error setting max validator:", e);
          quantityControl.addValidators(Validators.max(0));
        }
      }
    }
    quantityControl.updateValueAndValidity();
  }

  calculateMaxAllowedInSelectedUnitForDisplay(): string | null {
    const maxAllowed = this.calculateMaxAllowedInSelectedUnit(); // Gọi hàm trên
    if (maxAllowed === null) return '(Không xác định)';

    const currentRequestedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit;
    if (maxAllowed >= 0 && currentRequestedUnit) {
      // Làm tròn đến 2 chữ số thập phân để hiển thị nếu cần
      const displayValue = parseFloat(maxAllowed.toFixed(2));
      return `${displayValue} ${this.getUnitText(currentRequestedUnit)}`;
    }
    return `0 ${this.getUnitText(currentRequestedUnit)}`;
  }


  // Helper để tính toán số lượng tối đa có thể nhập theo đơn vị đang chọn (dùng cho hiển thị)
  calculateMaxAllowedInSelectedUnit(): number | null {
    const product = this.productContext();
    if (!product || product.stockQuantity == null) return null;

    const stockInBaseUnit = product.stockQuantity;
    const baseUnitOfProduct = product.unit as MassUnit; // Đơn vị gốc của sản phẩm (ví dụ: kg)
    const currentRequestedUnit = this.requestForm.get('requestedUnit')?.value as MassUnit;

    if (stockInBaseUnit >= 0 && baseUnitOfProduct && currentRequestedUnit) {
      try {
        const stockInKg = convertToKg(stockInBaseUnit, baseUnitOfProduct);
        const oneSelectedUnitInKg = convertToKg(1, currentRequestedUnit);

        if (oneSelectedUnitInKg > 0) {
          return stockInKg / oneSelectedUnitInKg; // Trả về số (có thể là thập phân)
        }
      } catch (e) {
        console.error("Error in calculateMaxAllowedInSelectedUnit:", e);
        return 0; // Lỗi quy đổi, coi như không thể nhập
      }
    }
    return 0; // Không tính được hoặc stock = 0
  }



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInitialLocations(): void { /* ... giữ nguyên ... */
    this.locationService.getProvinces().subscribe(p => this.provinces.set(p));
  }
  setupLocationCascades(): void { /* ... giữ nguyên ... */
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
  loadDefaultShippingAddress(): void { /* ... giữ nguyên ... */
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
            });
            if (addressData.provinceCode) {
              this.requestForm.get('shippingProvinceCode')?.setValue(addressData.provinceCode, { emitEvent: true });
              this.locationService.getDistricts(addressData.provinceCode).subscribe(districts => {
                this.districts.set(districts);
                if (districts.some(d => d.idDistrict === addressData.districtCode)) {
                  this.requestForm.get('shippingDistrictCode')?.setValue(addressData.districtCode, { emitEvent: true });
                  if (addressData.districtCode) {
                    this.locationService.getWards(addressData.districtCode).subscribe(wards => {
                      this.wards.set(wards);
                      if (wards.some(w => w.idWard === addressData.wardCode)) {
                        this.requestForm.patchValue({ shippingWardCode: addressData.wardCode });
                      } else {
                        this.requestForm.patchValue({ shippingWardCode: '' });
                      }
                      this.cdr.detectChanges();
                    });
                  } else {
                    this.wards.set([]); this.requestForm.patchValue({ shippingWardCode: '' }); this.cdr.detectChanges();
                  }
                } else {
                  this.requestForm.patchValue({ shippingDistrictCode: '', shippingWardCode: '' }); this.wards.set([]); this.cdr.detectChanges();
                }
              });
            } else {
              this.districts.set([]); this.wards.set([]);
              this.requestForm.patchValue({ shippingDistrictCode: '', shippingWardCode: '' });
              this.cdr.detectChanges();
            }
          } else {
            this.requestForm.patchValue({
              shippingFullName: buyer.fullName,
              shippingPhoneNumber: buyer.phoneNumber,
              shippingAddressDetail: '', shippingProvinceCode: '', shippingDistrictCode: '', shippingWardCode: ''
            });
            this.districts.set([]); this.wards.set([]);
          }
          this.cdr.detectChanges();
        });
    }
  }

  onSubmit(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Trigger validation lại một lần nữa trước khi submit, đặc biệt cho requestedQuantity
    this.requestForm.get('requestedQuantity')?.updateValueAndValidity();

    if (this.requestForm.invalid || !this.targetFarmerId || !this.targetProductId) {
      this.requestForm.markAllAsTouched();
      this.toastr.error('Vui lòng điền đầy đủ và chính xác thông tin yêu cầu.');
      // Log lỗi cụ thể của form
      Object.keys(this.requestForm.controls).forEach(key => {
        const controlErrors = this.requestForm.get(key)?.errors;
        if (controlErrors != null) {
          console.error('Key control: ' + key + ', errors: ' + JSON.stringify(controlErrors));
        }
      });
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.requestForm.getRawValue();

    const request: SupplyOrderPlacementRequest = {
      farmerId: this.targetFarmerId,
      productId: this.targetProductId,
      requestedQuantity: +formValue.requestedQuantity!,
      requestedUnit: formValue.requestedUnit!,
      proposedPricePerUnit: formValue.proposedPricePerUnit ? new BigDecimal(formValue.proposedPricePerUnit).getValue() : null, // Sửa ở đây
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
            this.requestForm.reset({ requestedUnit: MassUnit.KG }); // Reset về KG
            this.setQuantityValidators(); // Reset validator sau khi reset form
            this.router.navigate(['/user/my-supply-requests']);
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
}
