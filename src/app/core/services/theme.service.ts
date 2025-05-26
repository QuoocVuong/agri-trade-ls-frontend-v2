// src/app/core/services/theme.service.ts
import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private renderer: Renderer2;
  private _darkMode = new BehaviorSubject<boolean>(false);
  readonly darkMode$ = this._darkMode.asObservable();

  // Chọn theme light và dark mặc định của DaisyUI bạn muốn dùng
  private lightThemeName = 'light'; // Hoặc 'emerald', 'corporate', etc.
  private darkThemeName = 'dark';   // Hoặc 'forest', etc.

  constructor(private rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode) {
      const isDark = JSON.parse(savedMode);
      this._darkMode.next(isDark);
      this.applyTheme(isDark); // Sửa tên hàm cho rõ ràng hơn
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._darkMode.next(prefersDark);
      this.applyTheme(prefersDark);
    }
  }

  toggleDarkMode() {
    const isDark = !this._darkMode.value;
    this._darkMode.next(isDark);
    this.applyTheme(isDark);
    localStorage.setItem('darkMode', JSON.stringify(isDark));
  }

  // Sửa hàm này
  private applyTheme(isDark: boolean) {
    if (isDark) {
      this.renderer.addClass(document.documentElement, 'dark'); // Vẫn giữ class 'dark' cho Tailwind
      this.renderer.setAttribute(document.documentElement, 'data-theme', this.darkThemeName);
    } else {
      this.renderer.removeClass(document.documentElement, 'dark');
      this.renderer.setAttribute(document.documentElement, 'data-theme', this.lightThemeName);
    }
  }
}
