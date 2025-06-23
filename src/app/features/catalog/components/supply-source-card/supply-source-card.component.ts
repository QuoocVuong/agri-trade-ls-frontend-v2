// src/app/features/catalog/components/supply-source-card/supply-source-card.component.ts
import { Component, Input, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupplySourceResponse } from '../../dto/response/SupplySourceResponse';
import { AuthService } from '../../../../core/services/auth.service';
import { ChatService } from '../../../interaction/service/ChatService';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { LocationService } from '../../../../core/services/location.service';
import {SupplyOrderRequestService} from '../../../ordering/services/supply-order-request.service';
import {HttpErrorResponse} from '@angular/common/http';
import {ApiResponse} from '../../../../core/models/api-response.model';

import {ConfirmationService} from '../../../../shared/services/confirmation.service';

@Component({
  selector: 'app-supply-source-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, FormatBigDecimalPipe],
  templateUrl: './supply-source-card.component.html',

})
export class SupplySourceCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) supplySource!: SupplySourceResponse;

  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService);
  private destroy$ = new Subject<void>();

  private supplyRequestService = inject(SupplyOrderRequestService);

  private confirmationService = inject(ConfirmationService);

  isContactingSupplier = signal(false);
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;
  isNavigatingToRequestForm = signal(false);

  farmerProvinceName = signal<string | null>(null); // Signal cho tên tỉnh của nông dân

  ngOnInit(): void {
    if (this.supplySource?.farmerInfo?.provinceCode) {
      this.locationService.findProvinceName(this.supplySource.farmerInfo.provinceCode)
        .pipe(takeUntil(this.destroy$))
        .subscribe(name => this.farmerProvinceName.set(name || this.supplySource.farmerInfo.provinceCode));
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  contactSupplier(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để liên hệ nhà cung cấp.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const farmerId = this.supplySource?.farmerInfo?.farmerId;
    if (!farmerId) {
      this.toastr.error('Không tìm thấy thông tin nhà cung cấp.');
      return;
    }

    const currentUserId = this.currentUser()?.id;
    if (currentUserId && currentUserId === farmerId) {
      this.toastr.info('Bạn không thể tự liên hệ với chính mình.');
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
            const roomId = res.data.id;
            this.router.navigate(['/chat'], {
              queryParams: {
                roomId: roomId,

                contextProductId: this.supplySource.productId,
                contextProductName: this.supplySource.productName,
                contextProductSlug: this.supplySource.productSlug
              }
            });
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

  navigateToRequestForm(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để gửi yêu cầu.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const farmerId = this.supplySource?.farmerInfo?.userId; // Đã sửa ở lần trước
    const productId = this.supplySource?.productId;

    if (!farmerId || !productId) {
      this.toastr.error('Không đủ thông tin để tạo yêu cầu từ card này.');
      return;
    }

    const currentUserId = this.currentUser()?.id;
    if (currentUserId && currentUserId === farmerId) {
      this.toastr.info('Bạn không thể tự gửi yêu cầu cho chính mình.');
      return;
    }

    this.isNavigatingToRequestForm.set(true); // Set loading

    // 1. Gọi API kiểm tra quyền


    // Gọi API create, nhưng chúng ta chỉ quan tâm đến việc nó thành công hay trả về lỗi 403
    this.supplyRequestService.checkCreateRequestPermission()
      .pipe(finalize(() => this.isNavigatingToRequestForm.set(false)))
      .subscribe({
        next: (response) => {
          // 2. Nếu API thành công (mã 200 OK) -> người dùng có quyền
          if (response.success) {
            // Điều hướng đến form tạo yêu cầu thật sự
            this.router.navigate(['/user/orders/supply-request/new'], {
              queryParams: {
                farmerId: farmerId,
                productId: productId
              }
            });
          } else {
            // Trường hợp API trả về success: false nhưng không phải lỗi 403
            this.toastr.error(response.message || 'Không thể thực hiện hành động này.');
          }
        },
        error: (err: HttpErrorResponse) => {
          // 3. Nếu API trả về lỗi
          const apiError = err.error as ApiResponse<null>;
          const errorCode = apiError?.details?.['errorCode'];

          if (err.status === 403 && errorCode === 'BUSINESS_ACCOUNT_REQUIRED') {
            // 4. Xử lý lỗi "Cần tài khoản doanh nghiệp"
            this.confirmationService.open({
              title: 'Chức năng dành cho Đối tác',
              message: 'Tính năng gửi yêu cầu nguồn cung và mua hàng số lượng lớn chỉ dành cho các đối tác Nông dân và Doanh nghiệp đã được xác thực. Bạn có muốn nâng cấp tài khoản của mình ngay bây giờ không?',
              confirmText: 'Đăng ký Doanh nghiệp',
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
            // 5. Xử lý lỗi "Cần hoàn thiện hồ sơ doanh nghiệp"
            this.confirmationService.open({
              title: 'Hoàn Thiện Hồ Sơ Doanh Nghiệp',
              message: 'Bạn cần hoàn thiện hồ sơ doanh nghiệp của mình trước khi có thể gửi yêu cầu cung ứng. Đi đến trang hồ sơ ngay?',
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
            // 6. Xử lý các lỗi khác
            this.toastr.error(apiError?.message || 'Đã có lỗi xảy ra, vui lòng thử lại.');
          }
        }
      });
  }

  // Helper để lấy tên hiển thị cho nông dân
  getFarmerDisplayName(): string {
    if (!this.supplySource?.farmerInfo) return 'Nông dân';
    return this.supplySource.farmerInfo.farmName || this.supplySource.farmerInfo.fullName || 'Nông dân';
  }
}
