import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// Import các component dùng trực tiếp trong app.component.html (nếu có)
// Ví dụ: import { HeaderComponent } from './shared/components/header/header.component';

@Component({
  selector: 'app-root', // Selector để nhúng vào index.html
  standalone: true, // Đánh dấu là Standalone Component
  imports: [
    RouterOutlet, // Cần thiết để hiển thị các component được route đến
    // HeaderComponent, // Chỉ import nếu bạn đặt <app-header> trực tiếp ở đây thay vì trong layout
    // FooterComponent // Chỉ import nếu bạn đặt <app-footer> trực tiếp ở đây thay vì trong layout
    // Thường thì Header/Footer sẽ nằm trong các Layout Component (PublicLayout, DashboardLayout...)
  ],
  templateUrl: './app.component.html', // Trỏ đến file HTML (chỉ chứa <router-outlet>)
  //styleUrl: './app.component.css' // File CSS riêng (thường trống)
})
export class AppComponent {
  title = 'agri-trade-ls-frontend'; // Thuộc tính title mặc định, có thể xóa nếu không dùng
  // Không cần thêm logic gì ở đây trừ khi có yêu cầu rất đặc biệt ở cấp độ gốc ứng dụng.
}
