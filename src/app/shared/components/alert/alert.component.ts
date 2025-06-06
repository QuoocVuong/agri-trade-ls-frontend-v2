import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="message" role="alert" class="alert shadow-md mb-4" [ngClass]="alertClass">
      <svg *ngIf="type === 'success'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <svg *ngIf="type === 'info'" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <svg *ngIf="type === 'warning'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
      <svg *ngIf="type === 'error'" xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>

      <span class="whitespace-pre-line">{{ message }}</span> <!-- Hiển thị xuống dòng nếu có \n -->

      <button *ngIf="closable" class="btn btn-xs btn-ghost" (click)="closeAlert()">✕</button>
    </div>
  `,
})
export class AlertComponent {
  @Input() message: string | null = null;
  @Input() type: 'info' | 'success' | 'warning' | 'error' = 'info'; // Loại alert
  @Input() closable: boolean = false; // Có nút đóng không
  @Output() closed = new EventEmitter<void>(); // Sự kiện khi đóng

  get alertClass(): string {
    switch (this.type) {
      case 'success': return 'alert-success';
      case 'warning': return 'alert-warning';
      case 'error': return 'alert-error';
      case 'info':
      default: return 'alert-info';
    }
  }

  closeAlert(): void {
    this.message = null; // Ẩn alert
    this.closed.emit();
  }
}
