import { Component, OnInit, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Page } from '../../../../core/models/page.model';
import { UserProfileResponse } from '../../../user-profile/dto/response/UserProfileResponse'; // Import UserProfileResponse
import { AdminUserService } from '../../services/admin-user.service';
import { ApiResponse, PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { ModalComponent } from '../../../../shared/components/modal/modal.component';
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { VerificationStatus, getVerificationStatusText, getVerificationStatusCssClass } from '../../../../common/model/verification-status.enum';
import {FormControl, FormsModule, ReactiveFormsModule} from '@angular/forms';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe';
import {ConfirmationService} from '../../../../shared/services/confirmation.service'; // Import Enum và helpers

@Component({
  selector: 'app-approve-farmers',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, AlertComponent, PaginatorComponent, ModalComponent, DatePipe, FormsModule, FormatBigDecimalPipe,ReactiveFormsModule ],
  templateUrl: './approve-farmers.component.html',
})
export class ApproveFarmersComponent implements OnInit, OnDestroy {
  private adminUserService = inject(AdminUserService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private confirmationService = inject(ConfirmationService);
  pendingFarmersPage = signal<Page<UserProfileResponse> | null>(null); // Lưu UserProfileResponse đầy đủ
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Phân trang & Sắp xếp
  currentPage = signal(0);
  pageSize = signal(10);
  sort = signal('createdAt,asc'); // Sắp xếp theo ngày đăng ký cũ nhất trước

  // State cho modal chi tiết và từ chối
  showDetailModal = signal(false);
  showRejectModal = signal(false);
  selectedFarmer = signal<UserProfileResponse | null>(null);
  farmerToReject = signal<{ id: number, name: string } | null>(null);
  // rejectReason = signal('');
  rejectReasonControl = new FormControl('');


  // Helpers cho Status
  getStatusText = getVerificationStatusText;
  getStatusClass = getVerificationStatusCssClass;

  ngOnInit(): void {
    this.loadPendingFarmers();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadPendingFarmers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const page = this.currentPage();
    const size = this.pageSize();
    const sort = this.sort();

    this.adminUserService.getPendingFarmers(page, size, sort) // Gọi API lấy farmer chờ duyệt
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.pendingFarmersPage.set(res.data);
          } else {
            this.pendingFarmersPage.set(null);
            if(res.status !== 404 && !res.success) this.errorMessage.set(res.message || 'Không tải được danh sách nông dân chờ duyệt.');
          }
          this.isLoading.set(false);
        },
        error: (err) => this.handleError(err, 'Lỗi khi tải danh sách nông dân chờ duyệt.')
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadPendingFarmers();
  }

  // Mở modal xem chi tiết
  viewFarmerDetails(farmer: UserProfileResponse): void {
    this.selectedFarmer.set(farmer);
    this.showDetailModal.set(true);
  }

  // Đóng modal chi tiết
  closeDetailModal(): void {
    this.showDetailModal.set(false);
    this.selectedFarmer.set(null);
  }

  // Mở modal nhập lý do từ chối
  openRejectModal(farmer: UserProfileResponse): void { // Nhận UserProfileResponse
    this.farmerToReject.set({ id: farmer.id, name: farmer.fullName });
    this.rejectReasonControl.reset(''); // *** Reset FormControl ***
    this.showRejectModal.set(true);
  }

  // Đóng modal từ chối
  closeRejectModal(): void {
    this.showRejectModal.set(false);
    this.farmerToReject.set(null);
    this.rejectReasonControl.reset(''); // *** Reset FormControl ***
  }


// Duyệt Farmer
  approveFarmer(userId: number): void {

    this.confirmationService.open({
      title: 'Xác Nhận Duyệt Hồ Sơ',
      message: `Bạn có chắc chắn muốn DUYỆT hồ sơ nông dân này (ID: ${userId})? Sau khi duyệt, người dùng này sẽ có thể đăng bán sản phẩm.`,
      confirmText: 'Duyệt',
      cancelText: 'Hủy',
      confirmButtonClass: 'btn-success',
      iconClass: 'fas fa-user-check',
      iconColorClass: 'text-success'
    }).subscribe(confirmed => {
      if (confirmed) {
        this.isLoading.set(true); // Dùng loading chung hoặc tạo signal riêng
        this.adminUserService.approveFarmer(userId).subscribe({
          next: (res) => {
            if(res.success) {
              this.toastr.success('Đã duyệt hồ sơ nông dân thành công.');
              this.loadPendingFarmers(); // Load lại danh sách
            } else {
              this.handleError(res, 'Lỗi khi duyệt hồ sơ.');
            }
            this.isLoading.set(false);
          },
          error: (err) => this.handleError(err, 'Lỗi khi duyệt hồ sơ.')
        });
      }
      // Nếu `confirmed` là false, không làm gì cả.
    });

  }

  // Từ chối Farmer
  rejectFarmer(): void {
    const farmerInfo = this.farmerToReject();
    if (!farmerInfo) return;

    this.isLoading.set(true);
    const reason = this.rejectReasonControl.value || null; // *** Lấy giá trị từ FormControl ***
    this.adminUserService.rejectFarmer(farmerInfo.id, reason).subscribe({
      next: (res) => {
        if(res.success) {
          this.toastr.success(`Đã từ chối hồ sơ nông dân "${farmerInfo.name}".`);
          this.closeRejectModal();
          this.loadPendingFarmers(); // Load lại danh sách
        } else {
          this.handleError(res, 'Lỗi khi từ chối hồ sơ.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.handleError(err, 'Lỗi khi từ chối hồ sơ.');
        this.isLoading.set(false);
      }
    });
  }


  // Helper xử lý lỗi
  private handleError(err: any, defaultMessage: string): void {
    const message = err?.message || defaultMessage;
    this.errorMessage.set(message);
    this.toastr.error(message);
    this.isLoading.set(false);
    console.error(err);
  }

  trackUserById(index: number, item: UserProfileResponse): number {
    return item.id;
  }
}

// Cần tạo Enum VerificationStatus và các hàm helper nếu chưa có
// (File: src/app/common/model/verification-status.enum.ts - Mới)
/*
export enum VerificationStatus {
    PENDING = 'PENDING',
    VERIFIED = 'VERIFIED',
    REJECTED = 'REJECTED'
}
export function getVerificationStatusText(status: VerificationStatus | string | undefined | null): string { ... }
export function getVerificationStatusCssClass(status: VerificationStatus | string | undefined | null): string { ... }
*/
