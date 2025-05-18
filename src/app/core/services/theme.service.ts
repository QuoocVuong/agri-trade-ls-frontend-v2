import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private _darkMode = new BehaviorSubject<boolean>(false);
  readonly darkMode$ = this._darkMode.asObservable();

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    // Khôi phục trạng thái dark mode từ localStorage khi khởi động
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      this._darkMode.next(JSON.parse(savedMode));
      this.applyDarkMode(this._darkMode.value);
    } else {
      // Mặc định theo cài đặt hệ thống nếu chưa lưu
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._darkMode.next(prefersDark);
      this.applyDarkMode(prefersDark);
    }
  }

  toggleDarkMode() {
    const isDark = !this._darkMode.value;
    this._darkMode.next(isDark);
    this.applyDarkMode(isDark);
    localStorage.setItem('darkMode', JSON.stringify(isDark)); // Lưu trạng thái
  }

  private applyDarkMode(isDark: boolean) {
    if (isDark) {
      this.renderer.addClass(document.documentElement, 'dark');
    } else {
      this.renderer.removeClass(document.documentElement, 'dark');
    }
  }
}
