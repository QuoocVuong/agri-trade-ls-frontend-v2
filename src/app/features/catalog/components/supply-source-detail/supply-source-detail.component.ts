// src/app/features/catalog/components/supply-source-detail/supply-source-detail.component.ts
import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';

import { ProductService } from '../../services/product.service';
import { ProductDetailResponse } from '../../dto/response/ProductDetailResponse'; // Dùng lại DTO này từ backend
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import { ChatService } from '../../../interaction/service/ChatService';
import { LocationService } from '../../../../core/services/location.service';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import {ConfirmationService} from '../../../../shared/services/confirmation.service';
import {SupplyOrderRequestService} from '../../../ordering/services/supply-order-request.service';
import {HttpErrorResponse} from '@angular/common/http';
// Không cần ReviewList, ReviewForm nếu không hiển thị review ở đây
// Không cần ProductCardComponent cho sản phẩm liên quan ở đây (trừ khi bạn muốn)

@Component({
  selector: 'app-supply-source-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    DatePipe,
    DecimalPipe,
    FormatBigDecimalPipe,
    SafeHtmlPipe
  ],
  templateUrl: './supply-source-detail.component.html',
  // styleUrls: ['./supply-source-detail.component.css']
})
export class SupplySourceDetailComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);
  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService);
  private destroy$ = new Subject<void>();

  private supplyRequestService = inject(SupplyOrderRequestService);
  private confirmationService = inject(ConfirmationService);

  supplyDetail = signal<ProductDetailResponse | null>(null); // Dùng lại ProductDetailResponse
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  selectedImage = signal<string | null>(null);
  isContactingSupplier = signal(false);

  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;
  farmerProvinceName = signal<string | null>(null);

  // Kiểm tra xem đây có phải là sản phẩm của chính người dùng đang xem không
  isMySupplySource = computed(() => {
    const currentUserId = this.currentUser()?.id;
    const farmerId = this.supplyDetail()?.farmer?.farmerId;
    return this.isAuthenticated() && currentUserId != null && farmerId != null && currentUserId === farmerId;
  });

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        const productSlug = params.get('productSlug'); // Lấy slug của sản phẩm
        if (productSlug) {
          this.loadSupplyDetail(productSlug);
        } else {
          this.handleErrorAndRedirect('Thiếu thông tin định danh nguồn cung.');
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSupplyDetail(slug: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.farmerProvinceName.set(null);

    // Gọi API lấy chi tiết sản phẩm (backend đã cập nhật ProductDetailResponse với các trường sỉ)
    this.productService.getPublicProductBySlug(slug)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.supplyDetail.set(response.data);
            const defaultImg = response.data.images?.find(img => img.isDefault);
            this.selectedImage.set(defaultImg?.imageUrl || response.data.images?.[0]?.imageUrl || null);

            const farmerProvinceCode = response.data.farmer?.provinceCode;
            if (farmerProvinceCode) {
              this.locationService.findProvinceName(farmerProvinceCode)
                .pipe(takeUntil(this.destroy$))
                .subscribe(name => this.farmerProvinceName.set(name || farmerProvinceCode));
            } else {
              this.farmerProvinceName.set('Không xác định');
            }
          } else {
            this.handleErrorAndRedirect(response.message || 'Không tìm thấy thông tin nguồn cung.');
          }
        },
        error: (err: ApiResponse<null> | any) => {
          this.handleErrorAndRedirect(err.message || 'Lỗi khi tải thông tin nguồn cung.');
        }
      });
  }

  selectImage(imageUrl: string): void {
    this.selectedImage.set(imageUrl);
  }

  contactSupplier(): void {
    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để liên hệ.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const farmerId = this.supplyDetail()?.farmer?.farmerId;
    if (!farmerId) {
      this.toastr.error('Không tìm thấy thông tin nhà cung cấp của nguồn cung này.');
      return;
    }

    if (this.isMySupplySource()) {
      this.toastr.info('Đây là nguồn cung của bạn.');
      return;
    }

    this.isContactingSupplier.set(true);
    this.chatService.getOrCreateChatRoom(farmerId)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isContactingSupplier.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.id) {
            this.router.navigate(['/chat'], { queryParams: { roomId: res.data.id } });
          } else {
            this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
          }
        },
        error: (err) => {
          console.error('Error starting chat:', err);
          this.toastr.error(err.error?.message || 'Lỗi khi bắt đầu trò chuyện.');
        }
      });
  }

  getFarmerDisplayName(farmer: ProductDetailResponse['farmer']): string {
    if (!farmer) return 'Nông dân';
    return farmer.farmName || farmer.farmerName || 'Nông dân';
  }

  private handleErrorAndRedirect(message: string): void {
    this.errorMessage.set(message);
    this.isLoading.set(false);
    this.toastr.error(message);
    // Cân nhắc điều hướng về trang tìm nguồn cung hoặc trang chủ
    // this.router.navigate(['/supply-sources']);
  }

  trackImageById(index: number, item: any): any {
    return item.id || index; // Giả sử image có id
  }

  navigateToRequestForm(): void {
    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để gửi yêu cầu.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const farmerId = this.supplyDetail()?.farmer?.farmerId;
    const productId = this.supplyDetail()?.id; // ID của Product (nguồn cung)

    if (!farmerId || !productId) {
      this.toastr.error('Không đủ thông tin để tạo yêu cầu.');
      return;
    }
    if (this.isMySupplySource()) {
      this.toastr.info('Bạn không thể tự gửi yêu cầu cho chính mình.');
      return;
    }

    // Gọi API kiểm tra quyền
    this.supplyRequestService.checkCreateRequestPermission()
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.router.navigate(['/user/orders/supply-request/new'], {
              queryParams: { farmerId, productId }
            });
          } else {
            this.toastr.error(response.message || 'Không thể thực hiện hành động này.');
          }
        },
        error: (err: HttpErrorResponse) => {
          const apiError = err.error as ApiResponse<null>;
          const errorCode = apiError?.details?.['errorCode'];

          if (err.status === 403 && errorCode === 'BUSINESS_ACCOUNT_REQUIRED') {
            this.confirmationService.open({
              title: 'Chức năng dành cho Đối tác',
              message: 'Tính năng này chỉ dành cho các tài khoản Nông dân hoặc Doanh nghiệp đã được xác thực. Bạn có muốn đăng ký hồ sơ Doanh nghiệp không?',
              confirmText: 'Nâng cấp ngay',
              cancelText: 'Để sau',
              confirmButtonClass: 'btn-primary',
              iconClass: 'fas fa-briefcase',
              iconColorClass: 'text-primary'
            }).subscribe(confirmed => {
              if (confirmed) {
                this.router.navigate(['/user/profile/business-profile']);
              }
            });
          } else if (err.status === 400 && errorCode === 'BUSINESS_PROFILE_REQUIRED') {
            this.confirmationService.open({
              title: 'Hoàn Thiện Hồ Sơ Doanh Nghiệp',
              message: 'Bạn cần hoàn thiện hồ sơ doanh nghiệp của mình trước khi có thể gửi yêu cầu. Đi đến trang hồ sơ ngay?',
              confirmText: 'Đến trang hồ sơ',
              cancelText: 'Để sau',
              confirmButtonClass: 'btn-info',
              iconClass: 'fas fa-file-alt',
              iconColorClass: 'text-info'
            }).subscribe(confirmed => {
              if (confirmed) {
                this.router.navigate(['/user/profile/business-profile']);
              }
            });
          }
          else if (err.status === 400 && errorCode === 'FARMER_PROFILE_REQUIRED') {
            // Xử lý lỗi "Cần hoàn thiện hồ sơ nông dân"
            this.confirmationService.open({
              title: 'Hoàn Thiện Hồ Sơ Nông Dân',
              message: 'Bạn cần hoàn thiện hồ sơ nông dân của mình trước khi có thể gửi yêu cầu cung ứng. Đi đến trang hồ sơ ngay?',
              confirmText: 'Đến trang hồ sơ',
              cancelText: 'Để sau',
              confirmButtonClass: 'btn-accent', // Dùng màu khác
              iconClass: 'fas fa-seedling',
              iconColorClass: 'text-accent'
            }).subscribe(confirmed => {
              if (confirmed) {
                this.router.navigate(['/user/profile/farmer-profile']);
              }
            });
          }
          else {
            this.toastr.error(apiError?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.');
          }
        }
      });
  }
}
