import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-spinner',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex justify-center items-center" [style.height.px]="size === 'lg' ? 60 : (size === 'md' ? 40 : 24)">
      <span class="loading loading-spinner"
            [ngClass]="{
              'loading-lg': size === 'lg',
              'loading-md': size === 'md',
              'loading-sm': size === 'sm',
              'loading-xs': size === 'xs',
              'text-primary': color === 'primary',
              'text-secondary': color === 'secondary',
              'text-accent': color === 'accent',
              'text-info': color === 'info',
              'text-success': color === 'success',
              'text-warning': color === 'warning',
              'text-error': color === 'error'
            }">
      </span>
    </div>
  `,
})
export class LoadingSpinnerComponent {
  @Input() size: 'xs' | 'sm' | 'md' | 'lg' = 'md'; // Kích thước spinner
  @Input() color: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error' | null = 'primary'; // Màu spinner
}
