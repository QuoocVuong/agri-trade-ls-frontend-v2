import {Component, OnInit, inject, signal, WritableSignal, computed, effect, untracked} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { UserProfileResponse } from '../../dto/response/UserProfileResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import {AlertComponent} from '../../../../shared/components/alert/alert.component';
import {LocationService} from '../../../../core/services/location.service';
import {switchMap} from 'rxjs/operators';
import {FormatBigDecimalPipe} from '../../../../shared/pipes/format-big-decimal.pipe'; // Import AuthService

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AlertComponent, FormatBigDecimalPipe],
  templateUrl: './profile-view.component.html',
})
export class ProfileViewComponent implements OnInit {
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService); // Inject AuthService

  private locationService = inject(LocationService);

  profile: WritableSignal<UserProfileResponse | null> = signal(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Signals để lưu tên địa điểm
  provinceName = signal<string | null>(null);
  districtName = signal<string | null>(null);
  wardName = signal<string | null>(null);

  // Lấy các signal kiểm tra role từ AuthService
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');
  isConsumerOnly = computed(() => !this.isFarmer() && !this.isBusinessBuyer()); // Tính toán user chỉ là consumer

  constructor() {
    effect(() => {
      const currentProfile = this.profile();
      // Reset tên địa điểm mỗi khi profile thay đổi để tránh hiển thị tên cũ
      this.provinceName.set(null);
      this.districtName.set(null);
      this.wardName.set(null);

      untracked(() => { // Sử dụng untracked ở cấp cao nhất bên trong effect cho các lời gọi bất đồng bộ
        if (currentProfile?.farmerProfile) {
          const farmerProf = currentProfile.farmerProfile;
          if (farmerProf.provinceCode) {
            this.locationService.findProvinceName(farmerProf.provinceCode).subscribe(name => this.provinceName.set(name));
          }
          if (farmerProf.districtCode && farmerProf.provinceCode) { // Cần provinceCode để getDistricts
            this.locationService.getDistricts(farmerProf.provinceCode).pipe(
              switchMap(() => this.locationService.findDistrictName(farmerProf.districtCode!))
            ).subscribe(name => this.districtName.set(name));
          }
          if (farmerProf.wardCode && farmerProf.districtCode) { // Cần districtCode để getWards
            this.locationService.getWards(farmerProf.districtCode).pipe(
              switchMap(() => this.locationService.findWardName(farmerProf.wardCode!))
            ).subscribe(name => this.wardName.set(name));
          }
        } else if (currentProfile?.businessProfile) { // << THÊM LOGIC CHO BUSINESS PROFILE
          const businessProf = currentProfile.businessProfile;
          if (businessProf.businessProvinceCode) {
            this.locationService.findProvinceName(businessProf.businessProvinceCode).subscribe(name => this.provinceName.set(name));
          }
          if (businessProf.districtCode && businessProf.businessProvinceCode) {
            this.locationService.getDistricts(businessProf.businessProvinceCode).pipe(
              switchMap(() => this.locationService.findDistrictName(businessProf.districtCode!))
            ).subscribe(name => this.districtName.set(name));
          }
          if (businessProf.wardCode && businessProf.districtCode) {
            this.locationService.getWards(businessProf.districtCode).pipe(
              switchMap(() => this.locationService.findWardName(businessProf.wardCode!))
            ).subscribe(name => this.wardName.set(name));
          }
        }
      });
    });
  }


  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.userProfileService.getMyProfile().subscribe({
      next: (response: ApiResponse<UserProfileResponse>) => {
        if (response.success && response.data) {
          this.profile.set(response.data);
          // Cập nhật lại currentUser trong AuthService nếu cần
          // this.authService.updateCurrentUser(response.data);
        } else {
          this.errorMessage.set(response.message || 'Failed to load profile.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null>) => {
        this.errorMessage.set(err.message || 'An error occurred while loading profile.');
        this.isLoading.set(false);
        console.error(err);
      }
    });
  }

  getVerificationStatusText(status: string | undefined | null): string {
    if (!status) return 'Chưa cập nhật';
    switch (status) {
      case 'VERIFIED': return 'Đã xác minh';
      case 'PENDING_APPROVAL': return 'Chờ duyệt';
      case 'REJECTED': return 'Bị từ chối';
      default: return status;
    }
  }


  // Các hàm này sẽ được gọi từ template để hiển thị tên địa điểm
  // Chúng chỉ đơn giản trả về giá trị của signal tương ứng hoặc mã code nếu tên chưa có
  getProvinceName(provinceCode: string | undefined | null): string | null {
    if (!provinceCode) return null;
    return this.provinceName() || provinceCode;
  }

  getDistrictName(districtCode: string | undefined | null): string | null {
    if (!districtCode) return null;
    return this.districtName() || districtCode;
  }

  getWardName(wardCode: string | undefined | null): string | null {
    if (!wardCode) return null;
    return this.wardName() || wardCode;
  }
}
