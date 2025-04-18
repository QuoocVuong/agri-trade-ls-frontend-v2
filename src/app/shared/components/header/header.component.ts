import { Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service'; // Import AuthService
import { CommonModule } from '@angular/common'; // Import CommonModule for *ngIf etc.
//import { UserResponse } from '../../../usermanagement/dto/response/UserResponse'; // Import UserResponse if needed directly

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive], // Import CommonModule
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Sử dụng signal từ AuthService để biết trạng thái đăng nhập và thông tin user
  isLoggedIn = this.authService.isAuthenticated; // Giả sử AuthService có signal này
  user = this.authService.currentUser; // Giả sử AuthService có signal này

  // Các computed signal để kiểm tra role (ví dụ)
  isAdmin = computed(() => this.authService.hasRole('ROLE_ADMIN'));
  isFarmer = computed(() => this.authService.hasRole('ROLE_FARMER'));
  isBusinessBuyer = computed(() => this.authService.hasRole('ROLE_BUSINESS_BUYER'));
  isConsumer = computed(() => this.authService.hasRole('ROLE_CONSUMER'));


  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']); // Điều hướng về trang login sau khi logout
  }
}
