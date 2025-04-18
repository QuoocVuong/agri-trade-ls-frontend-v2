import { Component, Input, inject, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common'; // Import DecimalPipe
import {Router, RouterLink} from '@angular/router';
import { ProductSummaryResponse } from '../../dto/response/ProductSummaryResponse';
import { CartService } from '../../../ordering/services/cart.service'; // Import CartService
import { FavoriteService } from '../../../interaction/service/FavoriteService'; // Import FavoriteService
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService
import { ToastrService } from 'ngx-toastr';
import {Subject} from 'rxjs';
import {finalize, takeUntil} from 'rxjs/operators';
import {CartItemRequest} from '../../../ordering/dto/request/CartItemRequest';
import {ApiResponse} from '../../../../core/models/api-response.model';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, FormatBigDecimalPipe], // Thêm DecimalPipe
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: ProductSummaryResponse; // Nhận product từ component cha

  private cartService = inject(CartService);
  private favoriteService = inject(FavoriteService);
  private authService = inject(AuthService);
  private toastr = inject(ToastrService); // Inject Toastr
  private destroy$ = new Subject<void>(); // Để unsubscribe
  private router = inject(Router);

  isAddingToCart = signal(false);
  isTogglingFavorite = signal(false);
  // TODO: Cần signal hoặc cách kiểm tra xem sản phẩm này đã có trong favorite list chưa
  isFavorite = signal(false); // Ví dụ

  // Lấy trạng thái đăng nhập
  isAuthenticated = this.authService.isAuthenticated;

  ngOnInit(): void {
    // Kiểm tra trạng thái yêu thích ban đầu nếu user đăng nhập
    if (this.isAuthenticated() && this.product) {
      this.checkFavoriteStatus();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  checkFavoriteStatus(): void {
    this.favoriteService.isFavorite(this.product.id) // Service chỉ cần productId
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFav) => this.isFavorite.set(isFav),
        // Không cần xử lý lỗi ở đây, chỉ là kiểm tra trạng thái
        // error: (err) => console.error("Error checking favorite status", err)
      });
  }



  addToCart(event: MouseEvent): void {
    event.preventDefault(); // Ngăn không điều hướng khi bấm nút trong thẻ a
    event.stopPropagation(); // Ngăn sự kiện nổi bọt lên thẻ a cha

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để thêm vào giỏ hàng.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.isAddingToCart.set(true);
    const request: CartItemRequest = { productId: this.product.id, quantity: 1 };
    this.cartService.addItem(request) // Service sẽ tự lấy user từ AuthService nếu cần
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isAddingToCart.set(false))
      )
      .subscribe({ // Giả sử service cần user
      next: () => {
        console.log('Added to cart:', this.product.name);
        this.toastr.success(`Đã thêm "${this.product.name}" vào giỏ hàng!`);
        // CartService sẽ tự động cập nhật số lượng trên header qua BehaviorSubject/Signal
      },
        // *** Sửa kiểu dữ liệu cho err ***
        error: (err: ApiResponse<any> | any) => { // Dùng any nếu không chắc chắn cấu trúc lỗi
          const message = err?.message || 'Lỗi thêm vào giỏ hàng.';
          this.toastr.error(message);
          console.error('Error adding to cart:', err);
        }
      });
  }

  toggleFavorite(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để yêu thích sản phẩm.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }


    this.isTogglingFavorite.set(true);
    const currentIsFavorite = this.isFavorite(); // Lấy trạng thái hiện tại từ signal

  //*** Sửa tham số gọi service ***
    const action = currentIsFavorite
      ? this.favoriteService.removeFavorite(this.product.id) // Chỉ cần productId
      : this.favoriteService.addFavorite(this.product.id);    // Chỉ cần productId

    action
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isTogglingFavorite.set(false))
      )
      .subscribe({
        next: () => {
          this.isFavorite.set(!currentIsFavorite); // Đảo trạng thái thành công
          const message = currentIsFavorite ? 'Đã xóa khỏi yêu thích' : 'Đã thêm vào yêu thích';
          this.toastr.success(message);
          // TODO: Cập nhật favorite count trên product nếu cần (có thể cần load lại product)
        },
        error: (err: ApiResponse<any> | any) => {
          const message = err?.message || 'Thao tác thất bại.';
          this.toastr.error(message);
          console.error('Error toggling favorite:', err);
        }
      });
  }

  // Hàm trackBy (nếu component này dùng *ngFor, mặc dù hiện tại không)
  trackById(index: number, item: any): number {
    return item.id;
  }
}
