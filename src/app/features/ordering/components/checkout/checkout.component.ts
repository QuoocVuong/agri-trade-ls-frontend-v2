import { Component, OnInit, inject, signal, computed, ChangeDetectorRef } from '@angular/core';
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
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ToastrService } from 'ngx-toastr';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { OrderResponse } from '../../dto/response/OrderResponse';
import {finalize, takeUntil} from 'rxjs/operators';
import {log} from '@angular-devkit/build-angular/src/builders/ssr-dev-server';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {Subject} from 'rxjs';
import {AuthService} from '../../../../core/services/auth.service';

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

  checkoutForm!: FormGroup;
  addresses = signal<Address[]>([]);
  isLoadingAddresses = signal(true);
  isLoadingCheckout = signal(false);
  errorMessage = signal<string | null>(null);
  showNewAddressForm = signal(false);

  // Lấy giỏ hàng hiện tại
  cart = computed(() => this.cartService.getCurrentCart());

  // Lấy danh sách phương thức thanh toán hợp lệ (ví dụ lọc bỏ INVOICE)
  paymentMethods = Object.values(PaymentMethod).filter(m => m !== PaymentMethod.INVOICE);
  getPaymentMethodText = getPaymentMethodText;


  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  // Tính toán tạm thời (cần logic chính xác hơn)
  // TODO: Implement accurate shipping fee calculation
  shippingFee = signal<number>(15000); // Phí ship giả định
  discount = signal<number>(0); // Giảm giá giả định
  totalAmount = computed(() => {
    const subTotal = Number(this.cart()?.subTotal?.toString() ?? '0'); // Chuyển BigDecimal/string sang number
    return subTotal + this.shippingFee() - this.discount();
  });

  ngOnInit(): void {
    // Nếu giỏ hàng trống, quay về trang chủ hoặc giỏ hàng
    if (!this.cart() || (this.cart()?.items?.length ?? 0) === 0) {
      this.toastr.warning("Giỏ hàng trống, không thể thanh toán.");
      this.router.navigate(['/cart']);
      return; // Dừng thực thi ngOnInit
    }
    this.loadAddresses();
    this.initForm();
  }

  initForm(): void {
    this.checkoutForm = this.fb.group({
      shippingAddressId: [null, Validators.required],
      paymentMethod: [PaymentMethod.COD, Validators.required],
      notes: ['', Validators.maxLength(500)],
      purchaseOrderNumber: ['', Validators.maxLength(50)]
    });
  }

  loadAddresses(): void {
    this.isLoadingAddresses.set(true);
    this.userProfileService.getMyAddresses().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.addresses.set(res.data);
          const defaultAddress = res.data.find(addr => addr.isDefault);
          if (defaultAddress) {
            this.checkoutForm.patchValue({ shippingAddressId: defaultAddress.id });
          } else if (res.data.length > 0) {
            this.checkoutForm.patchValue({ shippingAddressId: res.data[0].id });
          } else {
            // Nếu không có địa chỉ nào, bắt buộc phải thêm mới
            this.showNewAddressForm.set(true);
            this.checkoutForm.controls['shippingAddressId'].clearValidators();
            this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
          }
        } else {
          // Lỗi tải địa chỉ, nhưng có thể cho phép thêm mới
          this.showNewAddressForm.set(true);
          this.checkoutForm.controls['shippingAddressId'].clearValidators();
          this.checkoutForm.controls['shippingAddressId'].updateValueAndValidity();
          this.toastr.warning(res.message || 'Không tải được địa chỉ đã lưu, vui lòng thêm địa chỉ mới.');
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
    if (this.checkoutForm.invalid && !this.showNewAddressForm()) {
      this.checkoutForm.markAllAsTouched();
      this.toastr.error("Vui lòng chọn địa chỉ giao hàng và phương thức thanh toán.");
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

    const formValue = this.checkoutForm.value;

    const requestData: CheckoutRequest = {
      shippingAddressId: formValue.shippingAddressId,
      paymentMethod: formValue.paymentMethod,
      notes: formValue.notes || null,
      purchaseOrderNumber: this.isBusinessBuyer() ? (formValue.purchaseOrderNumber || null) : null
    };

    this.orderService.checkout(requestData)
      .pipe(
        takeUntil(this.destroy$), // Giả sử có destroy$
        finalize(() => this.isLoadingCheckout.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            console.log('Checkout successful, orders created:', response.data);
            this.toastr.success('Đặt hàng thành công!');
            this.cartService.loadCart().subscribe(); // Cập nhật lại giỏ hàng (sẽ trống)
            // Điều hướng đến trang lịch sử đơn hàng hoặc trang cảm ơn
            // Lấy ID đơn hàng đầu tiên để điều hướng đến chi tiết (ví dụ)
            const firstOrderId = response.data[0]?.id;
            if (firstOrderId) {
              this.router.navigate(['/user/orders', firstOrderId]);
            } else {
              this.router.navigate(['/user/orders']);
            }
          } else {
            this.handleError(response, 'Đặt hàng thất bại.');
          }
        },
        error: (err) => this.handleError(err, 'Đã xảy ra lỗi khi đặt hàng.')
      });
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
