import {Component, OnInit, inject, signal, computed, ChangeDetectorRef} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { UserProfileService } from '../../../user-profile/services/user-profile.service';
import { Address } from '../../../user-profile/domain/address.model';
import { PaymentMethod, getPaymentMethodText } from '../../domain/payment-method.enum';
import { CheckoutRequest } from '../../dto/request/CheckoutRequest';
import { AddressFormComponent } from '../../../user-profile/components/address-form/address-form.component';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { CartValidationResponse } from '../../dto/response/CartValidationResponse'
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { ApiResponse } from '../../../../core/models/api-response.model';

import {distinctUntilChanged, finalize, map, switchMap, takeUntil} from 'rxjs/operators';

import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {Observable, of, shareReplay, Subject, throwError} from 'rxjs';
import {AuthService} from '../../../../core/services/auth.service';
import {LocationService} from '../../../../core/services/location.service';
import BigDecimal from 'js-big-decimal';
import {OrderType} from '../../domain/order-type.enum';
import {CartItemResponse} from '../../dto/response/CartItemResponse';
import {CartAdjustmentInfo} from '../../dto/response/CartAdjustmentInfo';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AddressFormComponent, LoadingSpinnerComponent, AlertComponent, DecimalPipe, FormatBigDecimalPipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  private fb = inject(FormBuilder);
  cartService = inject(CartService); // Để public cho template truy cập cart()
  private orderService = inject(OrderService);
  private userProfileService = inject(UserProfileService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private cdr = inject(ChangeDetectorRef);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);
  private locationService = inject(LocationService);
  private confirmationService = inject(ConfirmationService);

  checkoutForm!: FormGroup;
  addresses = signal<Address[]>([]);
  isLoadingAddresses = signal(true);
  isLoadingCheckout = signal(false);
  errorMessage = signal<string | null>(null);
  showNewAddressForm = signal(false);

  // ****** THÊM CACHE CHO TÊN ĐỊA DANH ******
  private locationNameCache = new Map<string, Observable<string | null>>();

  // Lấy giỏ hàng hiện tại
  cart = computed(() => this.cartService.getCurrentCart());







  getPaymentMethodText = getPaymentMethodText;




  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');





  shippingFee = signal<number>(15000); // Phí ship giả định
  discount = signal<number>(0); // Giảm giá giả định
  totalAmount = computed(() => {
    const subTotal = Number(this.cart()?.subTotal?.toString() ?? '0'); // Chuyển BigDecimal/string sang number
    return subTotal + this.shippingFee() - this.discount();
  });

  // Signals cho tổng tiền tính toán từ API (Cách 1)
  calculatedSubTotal = signal<number | string | BigDecimal>(0);
  calculatedShippingFee = signal<number | string | BigDecimal>(0);
  calculatedDiscount = signal<number | string | BigDecimal>(0);
  calculatedTotalAmount = signal<number | string | BigDecimal>(0);
  isLoadingTotals = signal(false);


  // ******  SIGNAL LƯU ORDER TYPE TỪ API ******
  orderTypeUsedInCalc = signal<OrderType | null>(null);



  OrderType = OrderType;


  availablePaymentMethods = computed<PaymentMethod[]>(() => { // <<< THÊM KIỂU TRẢ VỀ <PaymentMethod[]>
    const allMethods = Object.values(PaymentMethod);
    const orderType = this.orderTypeUsedInCalc();

    let allowedMethods: PaymentMethod[];

    if (orderType === OrderType.B2B) {
      // Nếu là đơn hàng B2B, chỉ cho phép thanh toán Công nợ hoặc Chuyển khoản
      allowedMethods = allMethods.filter(
        (m): m is PaymentMethod.INVOICE | PaymentMethod.BANK_TRANSFER =>
          m === PaymentMethod.INVOICE || m === PaymentMethod.BANK_TRANSFER
      );
    } else {
      // Nếu là đơn hàng B2C, cho phép các phương thức bán lẻ
      allowedMethods = allMethods.filter(
        (m): m is Exclude<PaymentMethod, PaymentMethod.INVOICE> =>
          m !== PaymentMethod.INVOICE
      );
    }

    // Loại bỏ MoMo và ZaloPay khỏi danh sách cuối cùng
    return allowedMethods.filter(m => m !== PaymentMethod.MOMO && m !== PaymentMethod.ZALOPAY);
  });


  constructor() {
    // Lắng nghe cart$ để tính lại totals
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cartData => {
        const selectedAddressId = this.checkoutForm?.get('shippingAddressId')?.value;
        if (this.checkoutForm) {
          if (cartData && cartData.items.length > 0) {
            this.calculateTotals({ shippingAddressId: selectedAddressId });
          } else {
            this.resetCalculatedTotals();
          }
        }
      });
  }


  ngOnInit(): void {
    // Nếu giỏ hàng trống, quay về trang chủ hoặc giỏ hàng
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.toastr.warning("Giỏ hàng trống, không thể thanh toán.");
      this.router.navigate(['/cart']);
      return; // Dừng thực thi ngOnInit
    }
    // Quan trọng: Khởi tạo form TRƯỚC khi load địa chỉ
    this.initForm();
    this.loadAddresses(); // Hàm này sẽ patch address và trigger effect ở trên

    // Lắng nghe thay đổi addressId từ form để tính lại totals
    this.checkoutForm.get('shippingAddressId')?.valueChanges
      .pipe(
        takeUntil(this.destroy$),
        distinctUntilChanged(), // Chỉ trigger khi ID thực sự thay đổi
        // skip(1) // Bỏ qua giá trị null ban đầu nếu không muốn tính toán với null
      )
      .subscribe(addressId => {
        console.log("shippingAddressId changed in form:", addressId);
        // Gọi tính toán khi địa chỉ thay đổi
        this.calculateTotals({ shippingAddressId: addressId });
      });
  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  loadInitialTotals(): void {
    const initialAddressId = this.checkoutForm.get('shippingAddressId')?.value;
    this.calculateTotals({ shippingAddressId: initialAddressId });
  }
  // ****** HÀM GỌI API TÍNH TOÁN ******
  calculateTotals(requestData: { shippingAddressId: number | null }): void {
    // Không tính nếu giỏ hàng trống
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.resetCalculatedTotals();
      return;
    }

    console.log("Calling calculateTotals API with request:", requestData); // Log để debug

    this.isLoadingTotals.set(true);
    this.errorMessage.set(null); // Xóa lỗi cũ
    this.orderService.calculateTotals(requestData)
      .pipe(
        takeUntil(this.destroy$),
        )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.calculatedSubTotal.set(res.data.subTotal);
            this.calculatedShippingFee.set(res.data.shippingFee);
            this.calculatedDiscount.set(res.data.discountAmount);
            this.calculatedTotalAmount.set(res.data.totalAmount);
            // ****** LƯU ORDER TYPE ******
            this.orderTypeUsedInCalc.set(res.data.calculatedOrderType);
            // Sau khi có orderType, cập nhật lại giá trị mặc định cho paymentMethod nếu cần
            const currentPaymentMethod = this.checkoutForm.get('paymentMethod')?.value;
            const allowedMethods = this.availablePaymentMethods(); // Lấy danh sách phương thức hợp lệ mới

            if (!allowedMethods.includes(currentPaymentMethod)) {
              // Nếu phương thức hiện tại không còn hợp lệ, chọn phương thức đầu tiên trong danh sách mới
              this.checkoutForm.patchValue({ paymentMethod: allowedMethods[0] ?? null }, { emitEvent: false });
            }
          } else {
            this.toastr.error(res.message || 'Lỗi tính toán tổng tiền đơn hàng.');
            this.resetCalculatedTotals(); // Reset về 0 nếu lỗi
          }
          this.isLoadingTotals.set(false); // Tắt loading khi thành công hoặc lỗi API
          this.cdr.markForCheck(); // Đảm bảo UI cập nhật sau khi set signal
        },
        error: (err) => {
          this.toastr.error(err.error?.message || 'Lỗi kết nối khi tính tổng tiền.');
          this.resetCalculatedTotals();
          this.isLoadingTotals.set(false); // Tắt loading khi lỗi kết nối
          this.cdr.markForCheck();
          this.errorMessage.set(err.error?.message || 'Lỗi kết nối khi tính tổng tiền.'); // Hiển thị lỗi chung
        }
      });
  }

  // Hàm reset giá trị tính toán
  private resetCalculatedTotals(): void {
    this.calculatedSubTotal.set(0);
    this.calculatedShippingFee.set(0);
    this.calculatedDiscount.set(0);
    this.orderTypeUsedInCalc.set(null);
    this.calculatedTotalAmount.set(0);
    this.isLoadingTotals.set(false);
  }






  initForm(): void {
    this.checkoutForm = this.fb.group({
      shippingAddressId: [null, Validators.required],
      // Lấy giá trị mặc định từ availablePaymentMethods signal sau khi effect chạy lần đầu
      // Hoặc đặt tạm là null và effect sẽ cập nhật
      paymentMethod: [null, Validators.required],
      notes: ['', Validators.maxLength(500)],
      purchaseOrderNumber: ['', Validators.maxLength(50)] // PO Number chỉ hiển thị cho B2B nhưng control vẫn tồn tại
    });
  }

  loadAddresses(): void {
    this.isLoadingAddresses.set(true);
    this.userProfileService.getMyAddresses().pipe(takeUntil(this.destroy$)).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.addresses.set(res.data);
          const defaultAddress = res.data.find(addr => addr.isDefault);

          const preselectAddressId = defaultAddress?.id ?? (res.data.length > 0 ? res.data[0].id : null);



          if (preselectAddressId) {
            // Patch value và trigger tính toán ban đầu
            this.checkoutForm.patchValue({ shippingAddressId: preselectAddressId }, { emitEvent: true }); // emitEvent: true để trigger effect
          } else {
            this.showNewAddressForm.set(true);
            this.checkoutForm.controls['shippingAddressId'].clearValidators();
            this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
            // Không cần gọi calculateTotals ở đây, effect cart sẽ xử lý hoặc valueChanges sẽ xử lý khi có địa chỉ
            this.resetCalculatedTotals(); // Reset khi không có địa chỉ ban đầu
          }
        } else {
          // Lỗi tải địa chỉ, nhưng có thể cho phép thêm mới
          this.showNewAddressForm.set(true);
          this.checkoutForm.controls['shippingAddressId'].clearValidators();
          this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
          this.toastr.warning(res.message || 'Không tải được địa chỉ đã lưu, vui lòng thêm địa chỉ mới.');
          // Gọi calculate với addressId là null
          //this.calculateTotals({ shippingAddressId: null });
        }
        this.isLoadingAddresses.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err.message || 'Lỗi tải danh sách địa chỉ.');
        this.isLoadingAddresses.set(false);
        this.showNewAddressForm.set(true); // Cho phép thêm mới nếu lỗi
        this.checkoutForm.controls['shippingAddressId'].clearValidators();
        this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();


      }
    });
  }

  toggleNewAddressForm(): void {
    this.showNewAddressForm.update(v => !v);
    const addressControl = this.checkoutForm.controls['shippingAddressId'];
    if (this.showNewAddressForm()) {
      addressControl.clearValidators();
      addressControl.setValue(null); // Bỏ chọn địa chỉ cũ
    } else {
      addressControl.setValidators(Validators.required);
      // Tự động chọn lại địa chỉ mặc định hoặc đầu tiên nếu có
      const defaultAddress = this.addresses().find(addr => addr.isDefault);
      const firstAddress = this.addresses().length > 0 ? this.addresses()[0] : null;
      addressControl.setValue(defaultAddress?.id ?? firstAddress?.id ?? null);
    }
    addressControl.updateValueAndValidity();
  }

  handleNewAddressSaved(newAddress: Address): void {
    this.loadAddresses(); // Tải lại danh sách
    this.checkoutForm.patchValue({ shippingAddressId: newAddress.id });
    this.showNewAddressForm.set(false);
    this.checkoutForm.controls['shippingAddressId'].setValidators(Validators.required);
    this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
    this.cdr.detectChanges(); // Cần detectChanges để cập nhật UI ngay lập tức
  }




  onSubmit(): void {
    // 1. Kiểm tra validation của form checkout (địa chỉ, PTTT)
    if (this.checkoutForm.invalid && !this.showNewAddressForm()) {
      this.checkoutForm.markAllAsTouched();
      const invalidControl = document.querySelector('form .ng-invalid');
      if (invalidControl) {
        (invalidControl as HTMLElement).focus();
        this.toastr.error("Vui lòng kiểm tra lại các trường thông tin được đánh dấu đỏ.", "Thông tin chưa hợp lệ");
      } else {
        this.toastr.error("Vui lòng chọn địa chỉ giao hàng và phương thức thanh toán.");
      }
      return;
    }

    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.toastr.error("Giỏ hàng của bạn đang trống.");
      this.router.navigate(['/cart']);
      return;
    }
    if(this.showNewAddressForm()) {
      this.toastr.warning("Vui lòng lưu địa chỉ mới hoặc hủy bỏ.");
      return;
    }

    this.isLoadingCheckout.set(true);
    this.errorMessage.set(null);

    // 2. *** KIỂM TRA LẠI GIỎ HÀNG TRƯỚC KHI SUBMIT  ***
    this.cartService.validateCart()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (validationRes) => {
          if (validationRes.success && validationRes.data) {
            const validationData = validationRes.data as CartValidationResponse;

            // Kịch bản 1: Có sự điều chỉnh trong giỏ hàng (giá, số lượng, hoặc sản phẩm bị xóa)
            if (validationData.adjustments && validationData.adjustments.length > 0) {
              this.isLoadingCheckout.set(false); // Tắt loading ngay lập tức

              // Tạo nội dung thông báo chi tiết từ danh sách adjustments
              const adjustmentMessages = validationData.adjustments.map(adj => `• ${adj.message}`).join('\n');
              const modalMessage = `Một vài sản phẩm trong giỏ hàng của bạn đã có thay đổi:\n\n${adjustmentMessages}\n\nVui lòng quay lại giỏ hàng để xem lại và tiến hành thanh toán lại.`;

              // Hiển thị Modal yêu cầu người dùng xác nhận và quay lại giỏ hàng
              this.confirmationService.open({
                title: 'Giỏ Hàng Đã Được Cập Nhật',
                message: modalMessage,
                confirmText: 'Về Giỏ Hàng', // Chỉ có một nút hành động chính
                cancelText: 'Đóng', // Nút phụ
                confirmButtonClass: 'btn-primary',
                iconClass: 'fas fa-info-circle',
                iconColorClass: 'text-info'
              }).subscribe(confirmed => {
                // Tải lại giỏ hàng để cập nhật state chung của ứng dụng
                this.cartService.loadCart().subscribe();
                // Bất kể người dùng nhấn nút nào, cũng điều hướng về giỏ hàng
                this.router.navigate(['/cart']);
              });

              return; // Dừng hoàn toàn quá trình checkout
            }

            // Kịch bản 2: Không có điều chỉnh nào và giỏ hàng hợp lệ
            if (validationData.valid) {
              // Tiến hành đặt hàng
              this.proceedToPlaceOrder();
            } else {
              // Kịch bản 3: Giỏ hàng không hợp lệ mà không rõ lý do từ adjustments
              this.toastr.error("Giỏ hàng không hợp lệ để thanh toán. Vui lòng quay lại giỏ hàng để kiểm tra.", "Lỗi");
              this.isLoadingCheckout.set(false);
              this.router.navigate(['/cart']);
            }

          } else {
            // Lỗi từ API validate
            this.toastr.error(validationRes.message || "Lỗi khi kiểm tra lại giỏ hàng. Vui lòng thử lại.");
            this.isLoadingCheckout.set(false);
          }
        },
        error: (err) => {
          // Lỗi kết nối khi validate
          this.toastr.error(err.error?.message || "Lỗi kết nối khi kiểm tra giỏ hàng.");
          this.isLoadingCheckout.set(false);
        }
      });
  }



  // --- TÁCH LOGIC ĐẶT HÀNG RA HÀM RIÊNG ---
  private proceedToPlaceOrder(): void {
    const formValue = this.checkoutForm.value;


    // Kiểm tra xem đã có kết quả tính toán chưa
    if (!this.calculatedTotalAmount()) {
      this.toastr.error('Không thể xác định tổng tiền đơn hàng. Vui lòng thử lại.');
      this.isLoadingCheckout.set(false);
      return;
    }


    const requestData: CheckoutRequest = {
      shippingAddressId: formValue.shippingAddressId,
      paymentMethod: formValue.paymentMethod,
      notes: formValue.notes || null,
      purchaseOrderNumber: this.isBusinessBuyer() ? (formValue.purchaseOrderNumber || null) : null,

      // Lấy giá trị từ signal và chuyển thành string nếu cần
      confirmedTotalAmount: new BigDecimal(this.calculatedTotalAmount().toString()).getValue()
    };

    this.orderService.checkout(requestData)
      .pipe(
        // Dùng switchMap để thực hiện hành động tiếp theo sau khi checkout thành công
        switchMap(orderResponse => {
          if (orderResponse.success && orderResponse.data && orderResponse.data.length > 0) {
            // Nếu checkout thành công, gọi API clearCart và chờ nó hoàn tất
            return this.cartService.clearCart().pipe(
              map(() => orderResponse) // Trả về lại orderResponse để xử lý tiếp
            );
          } else {
            // Nếu checkout không thành công, ném lỗi để khối error xử lý
            return throwError(() => orderResponse);
          }
        }),
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingCheckout.set(false))
      )
      .subscribe({
        next: (orderResponse) => {
          // Tại thời điểm này, cả checkout và clearCart đều đã thành công
          const firstOrder = orderResponse.data![0];

            if (firstOrder.paymentMethod === PaymentMethod.VNPAY) {
              this.toastr.info('Đơn hàng đã được tạo. Đang chuyển đến trang thanh toán VNPAY...', 'Chuyển hướng');
              this.createAndRedirectToPaymentGateway(firstOrder.id, PaymentMethod.VNPAY);
            } else if (firstOrder.paymentMethod === PaymentMethod.COD) {
              this.toastr.success('Đặt hàng thành công! Bạn sẽ thanh toán khi nhận hàng.', 'Thành công');
              this.router.navigate(['/user/orders', firstOrder.id]);
            } else if (firstOrder.paymentMethod === PaymentMethod.BANK_TRANSFER) {
              this.toastr.success('Đơn hàng đã được tạo. Vui lòng thực hiện chuyển khoản theo hướng dẫn.', 'Đặt hàng thành công');
              this.router.navigate(['/user/orders', firstOrder.id]);
            } else {
              this.toastr.success('Đặt hàng thành công!');
              this.router.navigate(['/user/orders', firstOrder.id]);
            }

        },
        error: (err) => {

          const apiError = err?.error as ApiResponse<null> || err;
          const defaultMessage = 'Đã xảy ra lỗi khi đặt hàng.';
          let errorMessage = apiError?.message || defaultMessage;

          // Nếu là lỗi BadRequest (400), có thể là do giá/tồn kho thay đổi
          if (err.status === 400) {
            errorMessage = `Đặt hàng thất bại: ${apiError.message}. Giỏ hàng của bạn có thể đã thay đổi. Vui lòng quay lại giỏ hàng để kiểm tra.`;

            // Hiển thị modal thay vì toastr
            this.confirmationService.open({
              title: 'Không Thể Đặt Hàng',
              message: errorMessage,
              confirmText: 'Về Giỏ Hàng',
              cancelText: 'Đóng',
              confirmButtonClass: 'btn-warning',
              iconClass: 'fas fa-exclamation-triangle',
              iconColorClass: 'text-warning'
            }).subscribe(() => {
              this.cartService.loadCart().subscribe(); // Tải lại giỏ hàng
              this.router.navigate(['/cart']); // Điều hướng về giỏ hàng
            });
          } else {

            this.handleCheckoutError(err, defaultMessage);
          }

        }
      });
  }


  private displayCartAdjustments(adjustments: CartAdjustmentInfo[], titlePrefix: string = "Giỏ hàng đã cập nhật"): void {
    adjustments.forEach(adj => {
      if (adj.type === 'REMOVED') {
        this.toastr.warning(adj.message, titlePrefix, { timeOut: 7000, closeButton: true});
      } else if (adj.type === 'ADJUSTED') {
        this.toastr.info(adj.message, titlePrefix, { timeOut: 7000, closeButton: true });
      }
    });
  }

  // Hàm  để xử lý redirect cho cổng thanh toán
  private createAndRedirectToPaymentGateway(orderId: number, paymentMethod: PaymentMethod): void {
    this.orderService.createPaymentUrl(orderId, paymentMethod) // Gọi API tạo URL
      .pipe(
        takeUntil(this.destroy$),

      )
      .subscribe({
        next: (paymentUrlRes) => {
          if (paymentUrlRes.success && paymentUrlRes.data?.paymentUrl) {
            // Chuyển hướng người dùng đến URL của VNPAY
            window.location.href = paymentUrlRes.data.paymentUrl;
          } else {
            this.errorMessage.set(paymentUrlRes.message || 'Không thể tạo URL thanh toán. Vui lòng thử lại.');
            this.toastr.error(paymentUrlRes.message || 'Không thể tạo URL thanh toán. Vui lòng thử lại.', 'Lỗi');
            this.isLoadingCheckout.set(false); // Tắt loading nếu không redirect được
          }
        },
        error: (err) => {
          this.handleCheckoutError(err, 'Lỗi khi tạo URL thanh toán.');
          this.isLoadingCheckout.set(false); // Tắt loading
        }
      });
  }

  // ******  HÀM getLocationName ******
  getLocationName(type: 'province' | 'district' | 'ward', code: string | null | undefined): Observable<string | null> {
    if (!code || code === 'undefined') {
      return of(null);
    }

    const cacheKey = `${type}_${code}`;
    if (this.locationNameCache.has(cacheKey)) {
      return this.locationNameCache.get(cacheKey)!;
    }

    let name$: Observable<string | null>;
    switch (type) {
      case 'province':
        name$ = this.locationService.findProvinceName(code);
        break;
      case 'district':
        name$ = this.locationService.findDistrictName(code);
        break;
      case 'ward':
        name$ = this.locationService.findWardName(code);
        break;
      default:
        name$ = of(null);
    }
    const cachedName$ = name$.pipe(shareReplay(1));
    this.locationNameCache.set(cacheKey, cachedName$);
    return cachedName$;
  }


  getDisplayInfo(item: CartItemResponse): { price: BigDecimal | null, unit: string | null } {
    const product = item.product;
    const quantity = item.quantity;
    if (!product) {
      return { price: null, unit: 'N/A' };
    }

    // Sử dụng isBusinessBuyer() signal đã có
    if (this.isBusinessBuyer() && product.b2bEnabled) { // Giả sử tên trường là b2bEnabled
      let finalPrice = product.b2bBasePrice ? new BigDecimal(product.b2bBasePrice.toString()) : null;
      const unit = product.b2bUnit ?? product.unit;

      if (product.pricingTiers && product.pricingTiers.length > 0) {
        const applicableTier = product.pricingTiers
          .filter(tier => quantity >= tier.minQuantity)
          .sort((a, b) => b.minQuantity - a.minQuantity)[0];

        if (applicableTier?.pricePerUnit) {
          finalPrice = new BigDecimal(applicableTier.pricePerUnit.toString());
        }
      }

      if (finalPrice === null) {
        finalPrice = product.price ? new BigDecimal(product.price.toString()) : null;
      }
      return { price: finalPrice, unit: unit };
    } else {
      return { price: product.price ? new BigDecimal(product.price.toString()) : null, unit: product.unit };
    }
  }

  calculateItemTotal(item: CartItemResponse): BigDecimal {
    const displayInfo = this.getDisplayInfo(item);
    if (displayInfo.price !== null && item.quantity > 0) {
      try {
        return displayInfo.price.multiply(new BigDecimal(item.quantity));
      } catch (e) {
        console.error("Error calculating item total for item:", item, e);
        return new BigDecimal(0);
      }
    }
    return new BigDecimal(0);
  }


  // Helper xử lý lỗi checkout chung
  private handleCheckoutError(err: any, defaultMessage: string): void {
    const apiError = err?.error as ApiResponse<null> || err;
    const message = apiError?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message, 'Đặt hàng thất bại', { timeOut: 7000 });
    this.isLoadingCheckout.set(false);
    console.error("Checkout error:", err);

    if (message.includes('không còn khả dụng')) {
      this.cartService.loadCart().subscribe(() => {
        this.cdr.markForCheck();
        if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
          this.toastr.info("Giỏ hàng của bạn hiện đã trống.");
          this.router.navigate(['/cart']);
        }
      });
    }
  }



  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoadingCheckout.set(false); // Tắt loading checkout
    console.error(err);
  }
}
