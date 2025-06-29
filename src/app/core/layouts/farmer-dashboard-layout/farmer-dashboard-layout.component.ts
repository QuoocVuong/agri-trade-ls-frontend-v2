import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { SidebarComponent } from '../../../shared/components/sidebar/sidebar.component';
import {BreadcrumbComponent} from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-farmer-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, BreadcrumbComponent],
  templateUrl: './farmer-dashboard-layout.component.html',
})
export class FarmerDashboardLayoutComponent {}
