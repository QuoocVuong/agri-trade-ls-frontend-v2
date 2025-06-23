

import { Component, OnInit, inject, signal, OnDestroy, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, of } from 'rxjs';
import { takeUntil, finalize, switchMap, catchError, tap, map } from 'rxjs/operators';
import { ToastrService } from 'ngx-toastr';
import { HttpErrorResponse } from '@angular/common/http';




import { FarmerProfileResponse } from '../../../user-profile/dto/response/FarmerProfileResponse';
import { ProductService } from '../../../catalog/services/product.service';
import { ProductSummaryResponse } from '../../../catalog/dto/response/ProductSummaryResponse';
import { LocationService } from '../../../../core/services/location.service';
import { AuthService } from '../../../../core/services/auth.service';
import { FollowService } from '../../../interaction/service/FollowService';
import { ApiResponse } from '../../../../core/models/api-response.model';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { ProductCardComponent } from '../../../catalog/components/product-card/product-card.component';
import { SafeHtmlPipe } from '../../../../shared/pipes/safe-html.pipe';
import {ChatService} from '../../../interaction/service/ChatService';
import {FarmerProfileService} from '../../services/farmer-profile.service';


@Component({
  selector: 'app-farmer-public-profile',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DatePipe,
    LoadingSpinnerComponent,
    AlertComponent,
    ProductCardComponent,
    SafeHtmlPipe,
  ],
  templateUrl: './farmer-public-profile.component.html',
})
export class FarmerPublicProfileComponent implements OnInit, OnDestroy {
  // --- Injections ---
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private farmerProfileService = inject(FarmerProfileService);
  private productService = inject(ProductService);
  private locationService = inject(LocationService);
  private authService = inject(AuthService);
  private followService = inject(FollowService);
  private toastr = inject(ToastrService);
  private destroy$ = new Subject<void>();
  private chatService = inject(ChatService);




  // --- Signals ---

  farmerProfile = signal<FarmerProfileResponse | null>(null);
  farmerProducts = signal<ProductSummaryResponse[]>([]);
  isLoadingProfile = signal(true);
  isLoadingProducts = signal(false);
  errorMessage = signal<string | null>(null);
  farmerId = signal<number | null>(null);
  provinceName = signal<string | null>(null);

  // Signals cho chức năng Follow
  isAuthenticated = this.authService.isAuthenticated;
  isCurrentUserProfile = computed(() => {
    const currentUserId = this.authService.currentUser()?.id;
    const profileFarmerId = this.farmerId();
    return this.isAuthenticated() && currentUserId != null && profileFarmerId != null && currentUserId === profileFarmerId;
  });
  isFollowing = signal(false);
  isTogglingFollow = signal(false);

  // --- Lifecycle Hooks ---
  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        map(params => params.get('id')),
        tap(idParam => {
          this.isLoadingProfile.set(true);
          this.errorMessage.set(null);
          this.farmerProfile.set(null);
          this.farmerProducts.set([]);
          this.provinceName.set(null);
          this.farmerId.set(null);
        }),
        map(idParam => {
          if (!idParam) {
            throw new Error('ID nhà bán không được cung cấp trên URL.');
          }
          const id = +idParam;
          if (isNaN(id)) {
            throw new Error('ID nhà bán không hợp lệ.');
          }
          this.farmerId.set(id);
          return id;
        }),
        switchMap(validId => {
          return this.farmerProfileService.getFarmerProfile(validId).pipe(
            catchError((err: HttpErrorResponse | ApiResponse<any>) => {
              this.handleLoadingError(err, `Không thể tải thông tin cho nhà bán ID ${validId}.`);
              return of(null);
            })
          );
        }),
        tap((response: ApiResponse<FarmerProfileResponse> | null) => {
          if (response && response.success && response.data) {
            this.farmerProfile.set(response.data); // Set dữ liệu đầy đủ
            this.loadProvinceName(response.data.provinceCode); // provinceCode từ profile
            this.loadFarmerProducts(response.data.userId); // userId từ profile
            if (this.isAuthenticated() && !this.isCurrentUserProfile()) {
              this.checkFollowStatus(response.data.userId);
            }
          } else if (response) {
            this.handleLoadingError(response, 'Không tìm thấy thông tin nhà bán.');
            this.router.navigate(['/not-found']).catch(navErr => console.error('Navigation error:', navErr));
          }
        }),
        catchError(err => {
          this.handleLoadingError(err, err.message || 'Lỗi xử lý ID nhà bán.');
          this.router.navigate(['/not-found']).catch(navErr => console.error('Navigation error:', navErr));
          return of(null);
        }),
        finalize(() => this.isLoadingProfile.set(false))
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // --- Data Loading Methods ---
  loadProvinceName(provinceCode: string | null | undefined): void {
    if (!provinceCode) {
      this.provinceName.set('Không xác định');
      return;
    }
    this.locationService.findProvinceName(provinceCode ?? undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(name => this.provinceName.set(name || `Mã ${provinceCode}`));
  }

  // Trong FarmerPublicProfileComponent.ts
  loadFarmerProducts(farmerUserId: number): void {
    this.isLoadingProducts.set(true);
    const page = 0; // Trang đầu
    const size = 8; // Số lượng
    const validSort = 'createdAt,desc'; // Sắp xếp


    this.productService.getPublicProductsByFarmerId(farmerUserId, page, size, validSort)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingProducts.set(false))
      )
      .subscribe({
        next: (response) => { // Kiểu dữ liệu response giữ nguyên
          if (response.success && response.data) {
            this.farmerProducts.set(response.data.content);
          } else {
            console.warn("Could not load farmer products:", response.message);
          }
        },
        error: (err) => { // Kiểu dữ liệu err giữ nguyên
          console.error("Error loading farmer products:", err);
          this.errorMessage.set('Lỗi tải sản phẩm của nhà bán.');
        }
      });
  }

  // --- Follow/Unfollow Logic ---
  checkFollowStatus(farmerUserId: number): void {
    this.followService.isFollowing(farmerUserId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (isFollowing: boolean) => this.isFollowing.set(isFollowing),
        error: (err: any) => console.error("Error checking follow status:", err)
      });
  }

  toggleFollow(): void {
    if (!this.isAuthenticated() || this.isCurrentUserProfile() || !this.farmerId()) {
      if (!this.isAuthenticated()) {
        this.toastr.info("Vui lòng đăng nhập để theo dõi nhà bán.");
        this.router.navigate(['/auth/login'], {queryParams: {returnUrl: this.router.url}}).catch(navErr => console.error('Navigation error:', navErr));
      }
      return;
    }

    this.isTogglingFollow.set(true);
    const farmerIdValue = this.farmerId();
    if (!farmerIdValue) {
      this.isTogglingFollow.set(false);
      return;
    }

    const action = this.isFollowing()
      ? this.followService.unfollowUser(farmerIdValue)
      : this.followService.followUser(farmerIdValue);

    action.pipe(
      takeUntil(this.destroy$),
      finalize(() => this.isTogglingFollow.set(false))
    ).subscribe({
      next: () => {
        this.isFollowing.update(val => !val);
        this.toastr.success(this.isFollowing() ? 'Đã theo dõi nhà bán.' : 'Đã bỏ theo dõi nhà bán.');
        // Cập nhật lại followerCount trong signal farmerProfile
        this.farmerProfile.update(profile => {
          if (profile) {
            // Đảm bảo followerCount không phải null trước khi tính toán
            const currentFollowers = profile.followerCount ?? 0;
            return {
              ...profile,
              followerCount: this.isFollowing() ? currentFollowers + 1 : Math.max(0, currentFollowers - 1)
            };
          }
          return profile;
        });
      },
      error: (err: HttpErrorResponse | ApiResponse<any>) => this.handleLoadingError(err, 'Thao tác thất bại.')
    });
  }

  // *** THÊM HÀM BẮT ĐẦU CHAT ***
  startChatWithFarmer(): void {
    const farmerUserId = this.farmerId(); // Lấy ID của farmer đang xem profile

    if (!this.isAuthenticated()) {
      this.toastr.info('Vui lòng đăng nhập để nhắn tin.');
      this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } }).catch(navErr => console.error('Navigation error:', navErr));
      return;
    }
    if (!farmerUserId) {
      this.toastr.error('Không tìm thấy thông tin nhà bán để bắt đầu chat.');
      return;
    }
    if (this.isCurrentUserProfile()) {
      this.toastr.info('Bạn không thể nhắn tin cho chính mình.');
      return;
    }

    // Gọi API để lấy hoặc tạo phòng chat
    this.chatService.getOrCreateChatRoom(farmerUserId).subscribe({
      next: (res) => {
        if (res.success && res.data?.id) {
          const roomId = res.data.id;
          // Điều hướng đến trang chat và truyền ID phòng chat qua queryParams
          this.router.navigate(['/chat'], { queryParams: { roomId: roomId } })
            .catch(navErr => console.error('Navigation error:', navErr));
        } else {
          this.toastr.error(res.message || 'Không thể bắt đầu cuộc trò chuyện.');
        }
      },
      error: (err) => {
        this.handleLoadingError(err, 'Lỗi khi bắt đầu cuộc trò chuyện.'); // Dùng lại hàm xử lý lỗi chung
      }
    });
  }


  // --- Helpers ---
  getFarmerDisplayName(farmer: FarmerProfileResponse | null): string {
    if (!farmer) return 'Nông dân';
    // *** Đảm bảo FarmerProfileResponse có cả farmName và fullName ***
    return farmer.farmName || farmer.fullName || 'Nông dân';
  }

  private handleLoadingError(err: HttpErrorResponse | ApiResponse<any> | null, defaultMessage: string): void {
    const message = (err && typeof err === 'object' && 'message' in err && err.message) ? err.message : (err instanceof Error ? err.message : defaultMessage);
    this.errorMessage.set(message);
    this.isLoadingProfile.set(false);
    this.isLoadingProducts.set(false);
    console.error("Error in FarmerPublicProfileComponent:", err);
  }

  trackProductById(index: number, item: ProductSummaryResponse): number {
    return item.id;
  }
}
