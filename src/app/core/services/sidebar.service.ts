// src/app/core/services/sidebar.service.ts
import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private _isOpen = signal(false);
  readonly isOpen = this._isOpen.asReadonly(); // Cho các component khác đọc

  toggle() {
    this._isOpen.update(open => !open);
    console.log('Sidebar toggled:', this._isOpen());
  }

  open() {
    this._isOpen.set(true);
  }

  close() {
    this._isOpen.set(false);
  }
}
