import { Component } from '@angular/core';
import { RouterLink } from '@angular/router'; // Import RouterLink để tạo link về trang chủ

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink], // Import RouterLink vào đây
  templateUrl: './not-found.component.html',
  //styleUrl: './not-found.component.css' // Có thể tạo file CSS riêng nếu cần
})
export class NotFoundComponent {
  // Không cần logic phức tạp ở đây, chủ yếu là template
}
