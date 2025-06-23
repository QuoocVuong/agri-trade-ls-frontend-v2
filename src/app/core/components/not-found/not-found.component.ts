import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found.component.html',

})
export class NotFoundComponent {
  // Không cần logic phức tạp ở đây, chủ yếu là template
}
