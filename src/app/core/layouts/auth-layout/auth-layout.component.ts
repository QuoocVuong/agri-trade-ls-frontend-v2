import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router'; // Import RouterLink

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink], // Import RouterLink
  templateUrl: './auth-layout.component.html',
})
export class AuthLayoutComponent {}
