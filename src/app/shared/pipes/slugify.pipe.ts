import { Pipe, PipeTransform } from '@angular/core';
import slugify from 'slugify';

@Pipe({
  name: 'slugify',
  standalone: true,
})
export class SlugifyPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    return slugify(value, {
      lower: true,         // chữ thường
      strict: true,        // bỏ ký tự đặc biệt
      locale: 'vi',        // xử lý dấu tiếng Việt
      trim: true,
    });
  }
}
