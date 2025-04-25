import { Component, Input, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() menuType: 'user' | 'farmer' | 'admin' = 'user'; // Nhận loại menu từ layout cha
  isMenuOpen: boolean = false;

  private authService = inject(AuthService);
  private router = inject(Router);

  // Lấy trạng thái role để ẩn/hiện link đăng ký bán hàng/doanh nghiệp
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER'); // Giả sử có hàm này trả về signal
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/auth/login']);
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }


  // Thêm SVG icons vào các mục menu nếu muốn
}
