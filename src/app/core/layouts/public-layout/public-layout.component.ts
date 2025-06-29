import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { FooterComponent } from '../../../shared/components/footer/footer.component';
import {BreadcrumbComponent} from '../../../shared/components/breadcrumb/breadcrumb.component';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, BreadcrumbComponent],
  templateUrl: './public-layout.component.html',

})
export class PublicLayoutComponent {}
