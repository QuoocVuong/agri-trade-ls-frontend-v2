import {Component, OnInit, inject, signal, computed, OnDestroy} from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common'; // Import Pipes
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product.service';
import { ProductDetailResponse } from '../../dto/response/ProductDetailResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { ProductCardComponent } from '../product-card/product-card.component'; // Import ProductCard
import { ReviewListComponent } from '../../../interaction/components/review-list/review-list.component'; // Import ReviewList
import { ReviewFormComponent } from '../../../interaction/components/review-form/review-form.component'; // Import ReviewForm
import { AuthService } from '../../../../core/services/auth.service'; // Import AuthService
import { CartService } from '../../../ordering/services/cart.service'; // Import CartService
import { FavoriteService } from '../../../interaction/service/FavoriteService'; // Import FavoriteService
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {CartItemRequest} from '../../../ordering/dto/request/CartItemRequest';
import {Subject} from 'rxjs';
import {ToastrService} from 'ngx-toastr';
import {finalize, takeUntil} from 'rxjs/operators';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {SafeHtmlPipe} from '../../../../shared/pipes/safe-html.pipe';
import {ReviewResponse} from '../../../interaction/dto/response/ReviewResponse';
import {ProductSummaryResponse} from '../../dto/response/ProductSummaryResponse';
import {LocationService} from '../../../../core/services/location.service'; // Import Forms
import {
  trigger,
  transition,
  style,
  animate
} from '@angular/animations';
import {ChatService} from '../../../interaction/service/ChatService';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DecimalPipe, // Thêm Pipe
    DatePipe,    // Thêm Pipe
    ReactiveFormsModule, // Thêm Forms
    LoadingSpinnerComponent,
    ProductCardComponent, // Component sản phẩm liên quan
    ReviewListComponent, // Component danh sách review
    ReviewFormComponent,
    FormatBigDecimalPipe,
    SafeHtmlPipe
    // Component form review
  ],
  templateUrl: './product-detail.component.html',
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-in-out', style({ opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-in-out', style({ opacity: 0 }))
      ])
    ])
  ]
})

export class ProductDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router); // Inject Router
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private cartService = inject(CartService);
  private favoriteService = inject(FavoriteService);
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private locationService = inject(LocationService);
  private chatService = inject(ChatService);
  product = signal<ProductDetailResponse | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  selectedImage = signal<string | null>(null); // URL ảnh đang được chọn để hiển thị lớn

  // State cho giỏ hàng và yêu thích
  isAddingToCart = signal(false);
  isTogglingFavorite = signal(false);
  isFavorite = signal(false); // Trạng thái yêu thích hiện tại
  farmerProvinceName = signal<string | null>(null);

  // *** THÊM COMPUTED SIGNAL KIỂM TRA SẢN PHẨM CỦA MÌNH ***
  isMyProduct = computed(() => {
    const currentUserId = this.authService.currentUser()?.id;
    const farmerId = this.product()?.farmer?.farmerId;
    return this.isAuthenticated() && currentUserId != null && farmerId != null && currentUserId === farmerId;
  });
  // *******************************************************

  // Form để nhập số lượng
  quantityForm = this.fb.group({
    quantity: [1, [Validators.required, Validators.min(1)]]
  });

  // Lấy trạng thái đăng nhập
  isAuthenticated = this.authService.isAuthenticated;

  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  // Lấy slug từ route
  productSlug = computed(() => this.route.snapshot.paramMap.get('slug'));

  ngOnInit(): void {
    const slug = this.productSlug();
    if (slug) {
      this.loadProduct(slug);
    } else {
      this.errorMessage.set('Không tìm thấy mã sản phẩm.');
      this.isLoading.set(false);
      // Có thể redirect về trang sản phẩm
       this.router.navigate(['/products']);
    }

  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadProduct(slug: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.farmerProvinceName.set(null); // Reset tên tỉnh
    this.productService.getPublicProductBySlug(slug)
      .pipe(takeUntil(this.destroy$)) // <-- Hủy subscription khi component destroy
      .subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.product.set(response.data);
          // Set ảnh default hoặc ảnh đầu tiên làm ảnh hiển thị lớn ban đầu
          const defaultImg = response.data.images?.find(img => img.isDefault);
          this.selectedImage.set(defaultImg?.imageUrl || response.data.images?.[0]?.imageUrl || null);

          // *** Lấy tên tỉnh cho farmer ***
          const farmerProvinceCode =response.data.farmer?.provinceCode;
          if (farmerProvinceCode) {
            this.locationService.findProvinceName(farmerProvinceCode)
              .pipe(takeUntil(this.destroy$)) // Hủy cả subscription này
              .subscribe(name => this.farmerProvinceName.set(name || `Mã ${farmerProvinceCode}`));
          } else {
            this.farmerProvinceName.set('Không xác định');
          }
          // ******************************

          // Kiểm tra trạng thái yêu thích nếu user đã đăng nhập
          if(this.isAuthenticated() && response.data.id) {
            this.checkFavoriteStatus(response.data.id);
          }
          // Cập nhật validator cho số lượng dựa trên tồn kho
          if (response.data.stockQuantity > 0) {
            this.quantityForm.controls.quantity.setValidators([
              Validators.required,
              Validators.min(1),
              Validators.max(response.data.stockQuantity) // Giới hạn max là tồn kho
            ]);
          } else {
            this.quantityForm.controls.quantity.setValidators([Validators.required, Validators.min(0), Validators.max(0)]); // Không cho nhập nếu hết hàng
            this.quantityForm.controls.quantity.setValue(0);
          }
          this.quantityForm.controls.quantity.updateValueAndValidity();


        } else {
          this.errorMessage.set(response.message || 'Không tìm thấy sản phẩm.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi tải sản phẩm.');
        this.isLoading.set(false);
        if (err.status === 404) {
          // Redirect về trang not found hoặc products
          this.router.navigate(['/not-found']);
        }
      }
    });
  }

  updateQuantityValidators(stock: number): void {
    const quantityControl = this.quantityForm.controls.quantity;
    if (stock > 0) {
      quantityControl.setValidators([
        Validators.required,
        Validators.min(1),
        Validators.max(stock)
      ]);
      if (quantityControl.value != null && quantityControl.value > stock) {
        quantityControl.setValue(stock);
      }
      if (quantityControl.value != null && quantityControl.value < 1) {
        quantityControl.setValue(1);
      }

    } else {
      quantityControl.setValidators([Validators.required, Validators.min(0), Validators.max(0)]);
      quantityControl.setValue(0);
      quantityControl.disable(); // Disable input nếu hết hàng
    }
    quantityControl.updateValueAndValidity();
  }

  // checkFavoriteStatus(productId: number): void {
  //   this.favoriteService.isFavorite(this.authService.currentUserSignal(), productId).subscribe({
  //     next: (isFav) => this.isFavorite.set(isFav),
  //     error: (err) => console.error("Error checking favorite status", err) // Không cần báo lỗi lớn
  //   });
  // }
  checkFavoriteStatus(productId: number): void {
    this.favoriteService.isFavorite(productId) // Gọi service đã sửa
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFav: boolean) => this.isFavorite.set(isFav),
        error: (err: ApiResponse<any> | any) => console.error("Error checking favorite status", err?.message || err)
      });
  }

  selectImage(imageUrl: string): void {
    this.selectedImage.set(imageUrl);
  }

  changeQuantity(amount: number): void {
    const currentQuantity = this.quantityForm.controls.quantity.value ?? 0;
    let newQuantity = currentQuantity + amount;
    const maxQuantity = this.product()?.stockQuantity ?? 0;

    if (newQuantity < 1) newQuantity = 1;
    if (newQuantity > maxQuantity) newQuantity = maxQuantity;
    if (maxQuantity <= 0) newQuantity = 0; // Không cho tăng nếu hết hàng

    this.quantityForm.controls.quantity.setValue(newQuantity);
  }

  addToCart(): void {
    if (this.quantityForm.invalid || !this.product()) {
      this.quantityForm.markAllAsTouched();
      return;
    }
    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để thêm vào giỏ hàng.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.isAddingToCart.set(true);
    const request: CartItemRequest = {
      productId: this.product()!.id, // Dùng ! vì đã kiểm tra product() ở trên
      quantity: this.quantityForm.value.quantity ?? 1
    };

    this.cartService.addItem(request) // Gọi service đã sửa
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isAddingToCart.set(false))
      )
      .subscribe({
        next: () => {
          this.toastr.success(`Đã thêm ${request.quantity} "${this.product()?.name}" vào giỏ hàng!`);
        },
        error: (err: ApiResponse<any> | any) => this.handleError(err, 'Lỗi thêm vào giỏ hàng.')
      });
  }

  toggleFavorite(): void {
    if (!this.isAuthenticated() || !this.product()) {
      this.toastr.info('Vui lòng đăng nhập để yêu thích sản phẩm.');
      this.router.navigate(['/auth/login'], {queryParams: {returnUrl: this.router.url}});
      return;
    }


    this.isTogglingFavorite.set(true);
    this.errorMessage.set(null); // Xóa lỗi cũ
    const currentIsFavorite = this.isFavorite();
    const productId = this.product()!.id;

    const action = currentIsFavorite
      ? this.favoriteService.removeFavorite(productId) // Gọi service đã sửa
      : this.favoriteService.addFavorite(productId);    // Gọi service đã sửa

    action
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isTogglingFavorite.set(false))
      )
      .subscribe({
        next: () => {
          this.isFavorite.update(fav => !fav); // Đảo trạng thái
          const message = this.isFavorite() ? 'Đã thêm vào yêu thích' : 'Đã xóa khỏi yêu thích';
          this.toastr.success(message);
        },
        error: (err: ApiResponse<any> | any) => this.handleError(err, 'Thao tác thất bại.')
      });
  }



  // Hàm mới để lấy tên hiển thị của farmer
  getFarmerDisplayName(farmer: ProductDetailResponse['farmer']): string {
    if (!farmer) return 'Nông dân';
    return farmer.farmName || 'Nông dân'; // Ưu tiên farmName, rồi đến fullName
  }

  // Hàm xử lý khi review được gửi thành công từ ReviewFormComponent
  onReviewSubmitted(newReview: ReviewResponse): void {
    console.log('New review submitted:', newReview);
    this.toastr.success("Đánh giá của bạn đã được gửi và đang chờ duyệt.");
    // TODO: Cập nhật danh sách review nếu cần (ví dụ: thêm vào đầu list với trạng thái PENDING)
  }
  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    console.error(err);
  }

  // *** THÊM HÀM BẮT ĐẦU CHAT ***
  startChatWithFarmer(): void {
    const farmerId = this.product()?.farmer?.farmerId;
    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để nhắn tin.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (!farmerId) {
      this.toastr.error('Không tìm thấy thông tin người bán.');
      return;
    }
    if (this.isMyProduct()) {
      this.toastr.info('Bạn không thể nhắn tin cho chính mình.');
      return;
    }

    // Gọi API để lấy hoặc tạo phòng chat
    // API này nên trả về ID của phòng chat
    this.chatService.getOrCreateChatRoom(farmerId).subscribe({
      next: (res) => {
        if (res.success && res.data?.id) {
          const roomId = res.data.id;
          // Điều hướng đến trang chat và truyền ID phòng chat
          this.router.navigate(['/chat'], { queryParams: { roomId: roomId } });
          // Hoặc nếu trang chat của bạn dùng route param:
          // this.router.navigate(['/chat', roomId]);
        } else {
          this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
        }
      },
      error: (err) => {
        this.toastr.error(err.message || 'Lỗi khi bắt đầu cuộc trò chuyện.');
        console.error(err);
      }
    });
  }
  // ****************************



  // Trong ProductDetailComponent.ts
  trackRelatedProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
}


