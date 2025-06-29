// src/app/shared/components/breadcrumb/breadcrumb.component.ts
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BreadcrumbService } from '../../../core/services/breadcrumb.service';
import { Observable } from 'rxjs';
import { Breadcrumb } from '../../../core/models/breadcrumb.model';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <nav *ngIf="breadcrumbs$ | async as breadcrumbs" aria-label="breadcrumb" class="text-sm">
      <ol class="flex items-center space-x-2 text-base-content/70 dark:text-gray-400">
        <!-- Nút Home luôn có -->
        <li>
          <a routerLink="/" class="hover:text-primary dark:hover:text-green-400 transition-colors">
            <i class="fas fa-home"></i>
          </a>
        </li>

        <!-- Lặp qua các breadcrumb -->
        <ng-container *ngFor="let breadcrumb of breadcrumbs; let last = last">
          <li>
            <span class="mx-1">/</span>
          </li>
          <li>
            <a *ngIf="!last" [routerLink]="breadcrumb.url" class="hover:text-primary dark:hover:text-green-400 transition-colors">
              {{ breadcrumb.label }}
            </a>
            <!-- Mục cuối cùng không phải là link -->
            <span *ngIf="last" class="font-semibold text-base-content dark:text-white" aria-current="page">
              {{ breadcrumb.label }}
            </span>
          </li>
        </ng-container>
      </ol>
    </nav>
  `
})
export class BreadcrumbComponent {
  private breadcrumbService = inject(BreadcrumbService);
  breadcrumbs$: Observable<Breadcrumb[]> = this.breadcrumbService.breadcrumbs$;
}
