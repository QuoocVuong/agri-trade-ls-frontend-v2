import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-unauthorized',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './unauthorized.component.html',
})
export class UnauthorizedComponent {
  private location = inject(Location);

  goBack(): void {
    this.location.back(); // Quay lại trang trước đó
  }
}
