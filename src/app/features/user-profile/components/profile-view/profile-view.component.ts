import {Component, OnInit, inject, signal, WritableSignal, computed} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserProfileService } from '../../services/user-profile.service';
import { UserProfileResponse } from '../../dto/response/UserProfileResponse';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';
import {AlertComponent} from '../../../../shared/components/alert/alert.component'; // Import AuthService

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [CommonModule, RouterLink, AlertComponent ],
  templateUrl: './profile-view.component.html',
})
export class ProfileViewComponent implements OnInit {
  private userProfileService = inject(UserProfileService);
  private authService = inject(AuthService); // Inject AuthService

  profile: WritableSignal<UserProfileResponse | null> = signal(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  // Lấy các signal kiểm tra role từ AuthService
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER');
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');
  isConsumerOnly = computed(() => !this.isFarmer() && !this.isBusinessBuyer()); // Tính toán user chỉ là consumer

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
}
