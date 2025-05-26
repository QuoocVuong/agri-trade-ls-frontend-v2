import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar-item',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <a [routerLink]="link"
       routerLinkActive="bg-primary/10 dark:bg-green-500/10 text-primary dark:text-green-400 font-semibold"
       [routerLinkActiveOptions]="{exact: exactMatch}"
       (click)="onClick()"
       class="flex items-center gap-3 py-2.5 px-4 rounded-lg hover:bg-base-200 dark:hover:bg-gray-700 transition-colors"
       [ngClass]="itemClass">
      <i *ngIf="icon" [class]="icon + ' w-5 h-5 text-base-content/70 dark:text-gray-400 group-[.active]:text-primary dark:group-[.active]:text-green-400'"></i>
      <span class="truncate">{{ label }}</span>
    </a>
  `
})
export class SidebarItemComponent {
  @Input({ required: true }) link!: string | any[];
  @Input({ required: true }) label!: string;
  @Input() icon?: string; // Ví dụ: 'fas fa-home'
  @Input() exactMatch: boolean = false;
  @Input() itemClass: string = ''; // Cho phép truyền class tùy chỉnh
  @Output() itemClick = new EventEmitter<void>();

  onClick(): void {
    this.itemClick.emit();
  }
}
