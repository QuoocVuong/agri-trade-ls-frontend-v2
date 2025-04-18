import { Directive, ElementRef, HostListener, Input, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appHighlight]', // Cách sử dụng: <p appHighlight> hoặc <p [appHighlight]="'yellow'">
  standalone: true,
})
export class HighlightDirective {
  @Input('appHighlight') highlightColor: string = 'yellow'; // Màu highlight mặc định
  @Input() defaultColor: string = ''; // Màu nền mặc định

  constructor(private el: ElementRef, private renderer: Renderer2) {}

  @HostListener('mouseenter') onMouseEnter() {
    this.highlight(this.highlightColor || 'yellow');
  }

  @HostListener('mouseleave') onMouseLeave() {
    this.highlight(this.defaultColor || null);
  }

  private highlight(color: string | null) {
    this.renderer.setStyle(this.el.nativeElement, 'backgroundColor', color);
    // Thêm các style khác nếu muốn (transition...)
    this.renderer.setStyle(this.el.nativeElement, 'transition', 'background-color 0.2s ease-in-out');
  }
}
