import { Component } from '@angular/core';
import {SidebarComponent} from '../../../shared/components/sidebar/sidebar.component';
import {RouterOutlet} from '@angular/router';
import {HeaderComponent} from '../../../shared/components/header/header.component';
import {BreadcrumbComponent} from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-user-dashboard-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, SidebarComponent, BreadcrumbComponent],
  templateUrl: './user-dashboard-layout.component.html',

})
export class UserDashboardLayoutComponent {

}
