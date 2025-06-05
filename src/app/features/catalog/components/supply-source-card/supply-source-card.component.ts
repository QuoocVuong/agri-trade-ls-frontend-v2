// src/app/features/catalog/components/supply-source-card/supply-source-card.component.ts
import { Component, Input, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { SupplySourceResponse } from '../../dto/response/SupplySourceResponse'; // Tạo DTO này nếu chưa có
import { AuthService } from '../../../../core/services/auth.service';
import { ChatService } from '../../../interaction/service/ChatService'; // Giả sử bạn có service này
import { ToastrService } from 'ngx-toastr';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { LocationService } from '../../../../core/services/location.service'; // Import LocationService

@Component({
  selector: 'app-supply-source-card',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, DatePipe, FormatBigDecimalPipe],
  templateUrl: './supply-source-card.component.html',
  // styleUrls: ['./supply-source-card.component.css'] // Nếu có CSS riêng
})
export class SupplySourceCardComponent implements OnInit, OnDestroy {
  @Input({ required: true }) supplySource!: SupplySourceResponse;

  private authService = inject(AuthService);
  private chatService = inject(ChatService);
  private router = inject(Router);
  private toastr = inject(ToastrService);
  private locationService = inject(LocationService); // Inject LocationService
  private destroy$ = new Subject<void>();

  isContactingSupplier = signal(false);
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

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
                // Gửi thêm thông tin sản phẩm và nông dân để hiển thị trong chat nếu cần
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

  // Helper để lấy tên hiển thị cho nông dân
  getFarmerDisplayName(): string {
    if (!this.supplySource?.farmerInfo) return 'Nông dân';
    return this.supplySource.farmerInfo.farmName || this.supplySource.farmerInfo.fullName || 'Nông dân';
  }
}
