import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component'; // Import Header
import { FooterComponent } from '../../../shared/components/footer/footer.component'; // Import Footer

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent], // Import vào đây
  templateUrl: './public-layout.component.html',
  // styleUrls: ['./public-layout.component.css'] // Nếu có CSS riêng
})
export class PublicLayoutComponent {}
