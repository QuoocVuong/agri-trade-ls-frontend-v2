import { Component, inject } from '@angular/core';
import { Location } from '@angular/common'; // Import Location
import { RouterLink } from '@angular/router'; // Import RouterLink

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink], // Import RouterLink
  templateUrl: './unauthorized.component.html',
})
export class UnauthorizedComponent {
  private location = inject(Location); // Inject Location service

  goBack(): void {
    this.location.back(); // Quay lại trang trước đó
  }
}
