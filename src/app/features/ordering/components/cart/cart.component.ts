import { Component, inject, signal, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core'; // Thêm ChangeDetection
import { CommonModule, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { CartResponse } from '../../dto/response/CartResponse';
import { CartItemResponse } from '../../dto/response/CartItemResponse';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { CartItemUpdateRequest } from '../../dto/request/CartItemUpdateRequest';
import { Observable, Subject } from 'rxjs'; // Import Subject
import { takeUntil, finalize } from 'rxjs/operators'; // Import takeUntil, finalize
import { NgxSpinnerService } from 'ngx-spinner'; // Ví dụ dùng thư viện spinner khác
import { ToastrService } from 'ngx-toastr'; // Ví dụ dùng thư viện toastr
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, LoadingSpinnerComponent, AlertComponent, FormatBigDecimalPipe ],
  templateUrl: './cart.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush // Tối ưu change detection
})
export class CartComponent {
  cartService = inject(CartService);
  router = inject(Router);
  cdr = inject(ChangeDetectorRef); // Inject ChangeDetectorRef
  spinner = inject(NgxSpinnerService); // Inject spinner service
  toastr = inject(ToastrService); // Inject toastr service

  cart$: Observable<CartResponse | null> = this.cartService.cart$;
  isLoading = this.cartService.isLoading;
  // Dùng Map để quản lý loading cho từng item hiệu quả hơn signal lồng
  itemLoadingMap = new Map<number, boolean>();
  clearLoading = signal(false);
  errorMessage = signal<string | null>(null);

  private destroy$ = new Subject<void>(); // Subject để unsubscribe

  ngOnInit(): void {
    // Không cần gọi loadCart vì service đã tự load khi user login
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  updateQuantity(item: CartItemResponse, newQuantity: number): void {
    // Bỏ kiểm tra newQuantity < 1 vì input number đã có min="1"
    if (!item.product || this.isItemLoading(item.id)) return;

    // *** Bỏ qua kiểm tra tồn kho ở đây ***
    // const maxQuantity = item.product.stockQuantity ?? 0; // Bỏ dòng này
    // if (newQuantity > maxQuantity) { ... } // Bỏ khối if này

    // Chỉ kiểm tra số lượng tối thiểu
    if (newQuantity < 1) {
      newQuantity = 1; // Set lại là 1 nếu user nhập số âm/0
      // Có thể cập nhật lại giá trị input nếu cần
    }


    this.setItemLoading(item.id, true);
    this.errorMessage.set(null);
    const request: CartItemUpdateRequest = { quantity: newQuantity };

    this.cartService.updateItemQuantity(item.id, request)
      .pipe(
        takeUntil(this.destroy$), // Tự động unsubscribe khi component destroy
        finalize(() => this.setItemLoading(item.id, false)) // Luôn tắt loading
      )
      .subscribe({
        // next: service đã tự load lại cart
        error: (err) => this.handleError(err, 'Lỗi cập nhật số lượng.')
      });
  }

  removeItem(itemId: number): void {
    if (this.isItemLoading(itemId)) return;

    this.setItemLoading(itemId, true);
    this.errorMessage.set(null);
    this.cartService.removeItem(itemId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.setItemLoading(itemId, false))
      )
      .subscribe({
        next: () => this.toastr.success('Đã xóa sản phẩm khỏi giỏ hàng.'),
        error: (err) => this.handleError(err, 'Lỗi xóa sản phẩm.')
      });
  }

  clearCart(): void {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ giỏ hàng?')) {
      this.clearLoading.set(true);
      this.errorMessage.set(null);
      this.cartService.clearCart()
        .pipe(
          takeUntil(this.destroy$),
          finalize(() => this.clearLoading.set(false))
        )
        .subscribe({
          next: () => this.toastr.success('Đã xóa toàn bộ giỏ hàng.'),
          error: (err) => this.handleError(err, 'Lỗi khi xóa giỏ hàng.')
        });
    }
  }

  goToCheckout(): void {
    const currentCart = this.cartService.getCurrentCart();
    if (currentCart && currentCart.items && currentCart.items.length > 0) {
      this.router.navigate(['/checkout']);
    } else {
      this.toastr.warning("Giỏ hàng của bạn đang trống.");
    }
  }

  // Helper quản lý loading map
  isItemLoading(itemId: number): boolean {
    return this.itemLoadingMap.get(itemId) ?? false;
  }
  private setItemLoading(itemId: number, isLoading: boolean): void {
    if (isLoading) {
      this.itemLoadingMap.set(itemId, true);
    } else {
      this.itemLoadingMap.delete(itemId);
    }
    this.cdr.markForCheck(); // Thông báo cho Angular kiểm tra thay đổi (do dùng OnPush)
  }

  // Helper xử lý lỗi chung
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message); // Hiển thị toast lỗi
    console.error(err);
    this.cdr.markForCheck(); // Thông báo thay đổi
  }

  // Hàm trackBy cho *ngFor
  trackCartItemById(index: number, item: CartItemResponse): number {
    return item.id;
  }
}
