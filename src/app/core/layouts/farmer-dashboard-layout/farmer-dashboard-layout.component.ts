import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component'; // Import Sidebar

@Component({
  selector: 'app-farmer-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent], // Import Sidebar
  templateUrl: './farmer-dashboard-layout.component.html',
})
export class FarmerDashboardLayoutComponent {}
