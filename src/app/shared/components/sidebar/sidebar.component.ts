import {Component, Input, inject, signal, HostListener} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CommonModule } from '@angular/common';
import {SidebarService} from '../../../core/services/sidebar.service';
import {SidebarItemComponent} from '../sidebar-item/sidebar-item.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, SidebarItemComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  @Input() menuType: 'user' | 'farmer' | 'admin' = 'user'; // Nhận loại menu từ layout cha
  // isMenuOpen: boolean = false; // <<< Bỏ biến cục bộ này

  private authService = inject(AuthService);
  private router = inject(Router);
  public sidebarService = inject(SidebarService); // INJECT SERVICE và để public

  // Sử dụng signal từ service
  isMenuOpen = this.sidebarService.isOpen; // <<< Lấy trạng thái từ service

  // Lấy trạng thái role để ẩn/hiện link đăng ký bán hàng/doanh nghiệp
  isFarmer = this.authService.hasRoleSignal('ROLE_FARMER'); // Giả sử có hàm này trả về signal
  isBusinessBuyer = this.authService.hasRoleSignal('ROLE_BUSINESS_BUYER');

  isDesktopView = signal(window.innerWidth >= 1024); // 1024px là breakpoint lg của Tailwind

  logout(): void {
    this.authService.logout();
    this.sidebarService.close(); // Đóng sidebar khi logout
    this.router.navigate(['/auth/login']);
  }

// KHÔNG CẦN toggleMenu() ở đây nữa vì nó được gọi từ service

  // ****** THÊM HÀM NÀY ******
  onMenuItemClick(): void {
    // Chỉ đóng menu nếu đang ở chế độ mobile (sidebar không phải static)
    if (!this.isDesktopView()) {
      this.sidebarService.close();
    }
  }
  @HostListener('window:resize', ['$event'])
  onResize(event?: Event) {
    this.isDesktopView.set(window.innerWidth >= 1024);
    if (this.isDesktopView() && this.sidebarService.isOpen()) {
      // Tự động đóng menu mobile nếu chuyển sang view desktop và menu đang mở
      // this.sidebarService.close(); // Tùy chọn: có thể không cần thiết
    }
  }


  // Thêm SVG icons vào các mục menu nếu muốn
}
