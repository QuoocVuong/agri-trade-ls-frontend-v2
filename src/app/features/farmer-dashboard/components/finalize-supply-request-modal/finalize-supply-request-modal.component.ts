
import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
  OnDestroy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ValidationErrors,
  AbstractControl, ValidatorFn
} from '@angular/forms';
import {firstValueFrom, startWith, Subject} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { SupplyOrderRequestResponse } from '../../../ordering/dto/response/SupplyOrderRequestResponse';
import { AgreedOrderRequest } from '../../../ordering/dto/request/AgreedOrderRequest';
import { OrderResponse } from '../../../ordering/dto/response/OrderResponse';
import { OrderService } from '../../../ordering/services/order.service';
import { PaymentMethod, getPaymentMethodText } from '../../../ordering/domain/payment-method.enum';
import { MassUnit, getMassUnitText } from '../../../catalog/domain/mass-unit.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service';
import BigDecimal from 'js-big-decimal';
import {ProductService} from '../../../catalog/services/product.service';
import {ProductDetailResponse} from '../../../catalog/dto/response/ProductDetailResponse';


export function futureDateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const controlValue = control.value;
    if (!controlValue) {
      return null; // Không validate nếu không có giá trị
    }

    const selectedDate = new Date(controlValue);
    const today = new Date();

    // Set giờ, phút, giây, ms về 0 để chỉ so sánh ngày
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    // Nếu ngày đã chọn nhỏ hơn ngày hôm nay, trả về lỗi
    if (selectedDate < today) {
      return { pastDate: true };
    }

    return null; // Hợp lệ
  };
}

@Component({
  selector: 'app-finalize-supply-request-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, AlertComponent, DatePipe, FormatBigDecimalPipe],
  templateUrl: './finalize-supply-request-modal.component.html',
})
export class FinalizeSupplyRequestModalComponent implements OnInit, OnChanges, OnDestroy {
  @Input() supplyRequest: SupplyOrderRequestResponse | null = null;
  @Output() orderFinalized = new EventEmitter<OrderResponse | null>(); // Trả về OrderResponse hoặc null nếu hủy/lỗi
  @Output() modalClosed = new EventEmitter<void>();

  private fb = inject(FormBuilder);
  private orderService = inject(OrderService);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService); // Nếu cần hiển thị/sửa địa chỉ
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);


  private productService = inject(ProductService);


  productContext = signal<ProductDetailResponse | null>(null); // Lưu thông tin sản phẩm mới nhất
  isLoadingProductContext = signal(false);


  finalizeForm!: FormGroup;
  isSubmitting = signal(false);
  errorMessage = signal<string | null>(null);

  paymentMethods = Object.values(PaymentMethod).filter(
    method => method === PaymentMethod.BANK_TRANSFER || method === PaymentMethod.INVOICE || method === PaymentMethod.COD
  );
  getPaymentMethodText = getPaymentMethodText;
  availableUnits = Object.values(MassUnit); // Đơn vị Farmer có thể chốt
  getUnitText = getMassUnitText;

  // Signals cho địa chỉ (nếu cho phép sửa)
  provinces = signal<Province[]>([]);
  districts = signal<District[]>([]);
  wards = signal<Ward[]>([]);

  constructor() {
    this.finalizeForm = this.fb.group({
      // Thông tin không cho sửa trực tiếp từ SupplyRequest (hiển thị readonly)
      buyerDisplay: [{ value: '', disabled: true }],
      originalProductDisplay: [{ value: '', disabled: true }],

      // Thông tin Farmer có thể chốt/sửa
      finalItems: this.fb.array([], Validators.required), // Sẽ có 1 item ban đầu
      finalTotalAmount: [{ value: '', disabled: true }, [Validators.required, Validators.min(0.01)]], // Sẽ tự tính
      paymentMethod: [PaymentMethod.INVOICE, Validators.required],
      paymentTermsDays: [null as number | null, [Validators.min(0)]], // Cho công nợ
      shippingFullName: ['', Validators.maxLength(100)],
      shippingPhoneNumber: ['', [Validators.pattern(/^(\+84|0)\d{9,10}$/)]],
      shippingAddressDetail: ['',  [Validators.required, Validators.maxLength(255)]],
      shippingProvinceCode: ['', Validators.required],
      shippingDistrictCode: ['', Validators.required],
      shippingWardCode: ['', Validators.required],
      farmerNotes: ['', Validators.maxLength(1000)],
      expectedDeliveryDate: ['', [Validators.required, futureDateValidator()]]
    });
  }

  ngOnInit(): void {
    this.loadInitialLocations(); // Nếu cho sửa địa chỉ
    this.setupLocationCascades();
    this.subscribeToItemChanges(); // Lắng nghe thay đổi item để tính tổng tiền
  }

  loadInitialLocations(): void {
    this.locationService.getProvinces().subscribe(p => this.provinces.set(p));
  }


  setupLocationCascades(): void {
    this.finalizeForm.get('shippingProvinceCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(provinceCode => {
        this.finalizeForm.get('shippingDistrictCode')?.setValue('');
        this.finalizeForm.get('shippingWardCode')?.setValue('');
        this.districts.set([]);
        this.wards.set([]);
        if (provinceCode) {
          this.locationService.getDistricts(provinceCode).subscribe(d => this.districts.set(d));
        }
      });

    this.finalizeForm.get('shippingDistrictCode')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(districtCode => {
        this.finalizeForm.get('shippingWardCode')?.setValue('');
        this.wards.set([]);
        if (districtCode) {
          this.locationService.getWards(districtCode).subscribe(w => this.wards.set(w));
        }
      });
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['supplyRequest'] && this.supplyRequest) {
      //this.patchFormWithSupplyRequestData(this.supplyRequest);
      this.loadDataForFinalization(this.supplyRequest);
    }
  }


  private loadDataForFinalization(req: SupplyOrderRequestResponse): void {
    if (!req.product?.id) {
      this.errorMessage.set('Yêu cầu không có thông tin sản phẩm hợp lệ.');
      return;
    }

    this.isLoadingProductContext.set(true);
    this.productService.getPublicProductById(req.product.id) // Gọi API lấy chi tiết sản phẩm
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingProductContext.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.productContext.set(res.data); // Lưu thông tin sản phẩm mới nhất
            this.patchFormWithSupplyRequestData(req, res.data); // Patch form với dữ liệu từ cả request và product
          } else {
            this.errorMessage.set(res.message || 'Không thể tải thông tin sản phẩm để chốt đơn.');
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải thông tin sản phẩm.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get finalItemsArray(): FormArray {
    return this.finalizeForm.get('finalItems') as FormArray;
  }

  createFinalItemFormGroup(itemData?: {
    originalProductId: number,
    productName: string,
    unit: MassUnit | string,
    quantity: number,
    pricePerUnit: number | BigDecimal | string | null
  }): FormGroup {
    return this.fb.group({
      originalProductId: [itemData?.originalProductId || null, Validators.required],
      productName: [itemData?.productName || '', Validators.required],
      unit: [itemData?.unit || MassUnit.KG, Validators.required],
      quantity: [itemData?.quantity || 1, [Validators.required, Validators.min(1)]],
      pricePerUnit: [itemData?.pricePerUnit || '', [Validators.required, Validators.min(0.01)]]
    });
  }

  patchFormWithSupplyRequestData(req: SupplyOrderRequestResponse, productData: ProductDetailResponse): void {
    this.finalizeForm.reset({ // Reset với giá trị mặc định nếu có
      paymentMethod: PaymentMethod.INVOICE // Giữ lại PTTT mặc định
      // Các giá trị mặc định khác nếu cần
    });
    this.finalItemsArray.clear(); // Xóa item cũ

    this.finalizeForm.patchValue({
      buyerDisplay: `${req.buyer?.fullName} (ID: ${req.buyer?.id})`,
      originalProductDisplay: `${req.product?.name} (ID: ${req.product?.id})`,

      shippingFullName: req.shippingFullName,
      shippingPhoneNumber: req.shippingPhoneNumber,
      shippingAddressDetail: req.shippingAddressDetail,

      farmerNotes: `Từ yêu cầu #${req.id}. Ghi chú của người mua: ${req.buyerNotes || ''}`,
      expectedDeliveryDate: req.expectedDeliveryDate
    });

    // Tạo item đầu tiên dựa trên SupplyRequest
    const initialItemData = {
      originalProductId: req.product!.id,
      productName: req.product!.name, // Farmer có thể sửa
      unit: req.requestedUnit as MassUnit,      // Farmer có thể sửa
      quantity: req.requestedQuantity,
      pricePerUnit: req.proposedPricePerUnit  || null // Ưu tiên giá buyer, rồi giá tham khảo
    };

    const itemGroup = this.createFinalItemFormGroup(initialItemData);
    // Thêm validator động cho 'quantity'
    itemGroup.get('quantity')?.setValidators([
      Validators.required,
      Validators.min(1),
      this.maxQuantityValidator(productData.stockQuantity) // Sử dụng tồn kho mới nhất
    ]);
    itemGroup.get('quantity')?.updateValueAndValidity();

    this.finalItemsArray.push(itemGroup);

    //this.finalItemsArray.push(this.createFinalItemFormGroup(initialItemData));
    this.calculateAndUpdateTotalAmount(); // Tính tổng tiền ban đầu


    // Xử lý địa chỉ với cascade một cách tuần tự
    if (req.shippingProvinceCode) {
      // 1. Set Province Code và đợi districts load xong
      this.finalizeForm.get('shippingProvinceCode')?.setValue(req.shippingProvinceCode);
      this.locationService.getDistricts(req.shippingProvinceCode)
        .pipe(takeUntil(this.destroy$)) // Quan trọng: Unsubscribe khi component destroy
        .subscribe(districts => {
          this.districts.set(districts);
          this.cdr.detectChanges(); // Cập nhật dropdown districts

          // 2. Sau khi districts đã được cập nhật, set District Code (nếu có và hợp lệ)
          if (req.shippingDistrictCode && districts.some(d => d.idDistrict === req.shippingDistrictCode)) {
            this.finalizeForm.get('shippingDistrictCode')?.setValue(req.shippingDistrictCode);
            // Việc setValue này sẽ trigger valueChanges của districtCode (trong setupLocationCascades)
            // để load wards. Chúng ta cần đợi wards load xong trước khi set wardCode.
            this.locationService.getWards(req.shippingDistrictCode!)
              .pipe(takeUntil(this.destroy$))
              .subscribe(wards => {
                this.wards.set(wards);
                this.cdr.detectChanges(); // Cập nhật dropdown wards

                // 3. Sau khi wards đã được cập nhật, set Ward Code (nếu có và hợp lệ)
                if (req.shippingWardCode && wards.some(w => w.idWard === req.shippingWardCode)) {
                  this.finalizeForm.get('shippingWardCode')?.setValue(req.shippingWardCode);
                } else {
                  this.finalizeForm.get('shippingWardCode')?.setValue('');
                }
                this.cdr.detectChanges(); // Cập nhật lần cuối
              });
          } else {
            this.finalizeForm.get('shippingDistrictCode')?.setValue('');
            this.finalizeForm.get('shippingWardCode')?.setValue('');
            this.wards.set([]); // Reset wards nếu district không hợp lệ
            this.cdr.detectChanges();
          }
        });
    } else {
      // Nếu không có province code từ request, reset hết
      this.finalizeForm.patchValue({
        shippingProvinceCode: '',
        shippingDistrictCode: '',
        shippingWardCode: ''
      });
      this.districts.set([]);
      this.wards.set([]);
      this.cdr.detectChanges();
    }
  }

  private maxQuantityValidator(maxStock: number): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const enteredQuantity = control.value;
      if (enteredQuantity > maxStock) {
        return { maxQuantityExceeded: { max: maxStock, actual: enteredQuantity } };
      }
      return null;
    };
  }

  subscribeToItemChanges(): void {
    this.finalItemsArray.valueChanges.pipe(
      startWith(this.finalItemsArray.value), // Tính toán ngay khi form được patch
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.calculateAndUpdateTotalAmount();
    });
  }

  calculateAndUpdateTotalAmount(): void {
    let total = new BigDecimal(0);
    this.finalItemsArray.controls.forEach(control => {
      const qty = control.get('quantity')?.value;
      const price = control.get('pricePerUnit')?.value;
      if (qty && price && +qty > 0 && +price > 0) {
        try {
          total = total.add(new BigDecimal(qty).multiply(new BigDecimal(price)));
        } catch (e) { /* Bỏ qua nếu lỗi parse */ }
      }
    });
    this.finalizeForm.get('finalTotalAmount')?.setValue(total.getValue(), { emitEvent: false });
  }

  async onSubmit(): Promise<void> {
    this.errorMessage.set(null);
    // Kiểm tra và hiển thị tất cả lỗi nếu form không hợp lệ
    if (this.finalizeForm.invalid) {
      this.finalizeForm.markAllAsTouched(); // Đánh dấu tất cả các trường là "đã chạm" để hiển thị lỗi
      this.toastr.error('Vui lòng kiểm tra lại các thông tin được đánh dấu đỏ.');

      // (Tùy chọn) Focus vào control đầu tiên bị lỗi
      const firstErrorControl = document.querySelector('.modal-box .ng-invalid');
      if (firstErrorControl) {
        (firstErrorControl as HTMLElement).focus();
      }

      return; // Dừng thực thi
    }

    if (!this.supplyRequest) {
      this.toastr.error('Thiếu thông tin yêu cầu gốc.');
      return;
    }


    this.isSubmitting.set(true);

    // --- BƯỚC KIỂM TRA TỒN KHO LẦN CUỐI ---
    try {
      const latestProductRes = await firstValueFrom(this.productService.getPublicProductById(this.productContext()!.id));
      if (!latestProductRes.success || !latestProductRes.data) {
        throw new Error('Không thể xác thực lại tồn kho sản phẩm.');
      }

      const latestStock = latestProductRes.data.stockQuantity;
      const requestedQuantity = this.finalizeForm.value.finalItems[0].quantity;

      if (requestedQuantity > latestStock) {
        this.toastr.error(`Rất tiếc, số lượng tồn kho của sản phẩm đã thay đổi. Chỉ còn ${latestStock}. Vui lòng điều chỉnh lại.`, 'Tồn kho không đủ', { timeOut: 7000 });
        this.productContext.set(latestProductRes.data); // Cập nhật lại context
        // Cập nhật lại validator và giá trị của ô số lượng
        const itemControl = this.finalItemsArray.at(0);
        itemControl.get('quantity')?.setValidators([Validators.required, Validators.min(1), this.maxQuantityValidator(latestStock)]);
        itemControl.get('quantity')?.setValue(latestStock); // Gợi ý số lượng tối đa
        itemControl.get('quantity')?.markAsTouched();
        this.isSubmitting.set(false);
        return;
      }
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Lỗi khi xác thực tồn kho.');
      this.isSubmitting.set(false);
      return;
    }
    // --- KẾT THÚC KIỂM TRA TỒN KHO ---

    const formValue = this.finalizeForm.getRawValue();

    const agreedOrderRequest: AgreedOrderRequest = {
      buyerId: this.supplyRequest!.buyer!.id, // Lấy từ supplyRequest gốc
      // farmerId sẽ được lấy từ Authentication ở backend
      items: formValue.finalItems.map((item: any) => ({
        productId: item.originalProductId, // ID của nguồn cung gốc
        productName: item.productName,
        unit: item.unit,
        quantity: +item.quantity,
        pricePerUnit: new BigDecimal(item.pricePerUnit).getValue()
      })),
      agreedTotalAmount: new BigDecimal(formValue.finalTotalAmount).getValue(),
      agreedPaymentMethod: formValue.paymentMethod!,
      shippingFullName: formValue.shippingFullName,
      shippingPhoneNumber: formValue.shippingPhoneNumber,
      shippingAddressDetail: formValue.shippingAddressDetail,
      shippingProvinceCode: formValue.shippingProvinceCode,
      shippingDistrictCode: formValue.shippingDistrictCode,
      shippingWardCode: formValue.shippingWardCode,
      notes: formValue.farmerNotes, // Ghi chú của Farmer
      expectedDeliveryDate: formValue.expectedDeliveryDate,
      // paymentTermsDays: formValue.paymentTermsDays // Nếu có
    };

    // Gọi OrderService để tạo "Đơn hàng thỏa thuận"
    this.orderService.createAgreedOrder(agreedOrderRequest)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isSubmitting.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.orderFinalized.emit(res.data); // Gửi OrderResponse về component cha
          } else {
            this.errorMessage.set(res.message || 'Tạo đơn hàng thỏa thuận thất bại.');
            this.toastr.error(res.message || 'Tạo đơn hàng thỏa thuận thất bại.');
            this.orderFinalized.emit(null);
          }
        },
        error: (err) => {
          this.errorMessage.set(err.error?.message || 'Lỗi khi tạo đơn hàng thỏa thuận.');
          this.toastr.error(err.error?.message || 'Lỗi khi tạo đơn hàng thỏa thuận.');
          this.orderFinalized.emit(null);
        }
      });
  }

  onCancel(): void {
    this.modalClosed.emit();
  }

  protected readonly PaymentMethod = PaymentMethod;
}
