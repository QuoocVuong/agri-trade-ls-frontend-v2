import { Pipe, PipeTransform, inject, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml | null {
    if (value === null || value === undefined) {
      return null;
    }
    // Sử dụng bypassSecurityTrustHtml cẩn thận, chỉ khi bạn tin tưởng nguồn HTML
    return this.sanitizer.bypassSecurityTrustHtml(value);
    // Hoặc dùng sanitize nếu muốn loại bỏ các thẻ nguy hiểm
    // return this.sanitizer.sanitize(SecurityContext.HTML, value);
  }
}
