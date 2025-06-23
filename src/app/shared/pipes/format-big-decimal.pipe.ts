import { Pipe, PipeTransform, inject, LOCALE_ID } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import  BigDecimal  from 'js-big-decimal';

@Pipe({
  name: 'formatBigDecimal',
  standalone: true,
})
export class FormatBigDecimalPipe implements PipeTransform {
  // Inject LOCALE_ID để sử dụng locale hiện tại của ứng dụng
  private locale = inject(LOCALE_ID);
  // Tạo instance của DecimalPipe với locale đã inject
  private decimalPipe = new DecimalPipe(this.locale);


  transform(
    value: number | string | BigDecimal | null | undefined,
    digitsInfo: string = '1.0-0', // Format mặc định không có phần thập phân
    locale?: string // Cho phép override locale nếu cần
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    let numberValue: number | string;

    // 1. Chuyển đổi BigDecimal sang string một cách an toàn
    if (value instanceof BigDecimal) {
      try {
        // Sử dụng toFixed() để lấy chuỗi số thập phân với số lượng chữ số mong muốn (nếu cần)
        // Hoặc dùng toString() để lấy biểu diễn chuỗi đầy đủ
        // numberValue = value.toString(); // Thử cách khác nếu toString() lỗi
        numberValue = value.getValue(); // <<< THỬ DÙNG getValue()
        // Ví dụ nếu muốn làm tròn trước khi format:
        // const scale = digitsInfo.match(/\.\d+-(\d+)/)?.[1]; // Lấy số chữ số thập phân từ digitsInfo
        // numberValue = value.round(scale ? parseInt(scale, 10) : 0).toString();
      } catch (e) {
        console.error("Error converting BigDecimal to string:", e);
        return 'N/A'; // Hoặc giá trị lỗi khác
      }
    }
    // 2. Kiểm tra nếu là string, cố gắng parse thành number (DecimalPipe cũng làm điều này nhưng làm trước an toàn hơn)
    else if (typeof value === 'string') {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) {
        console.warn(`FormatBigDecimalPipe: Could not parse string "${value}" to number.`);
        // Có thể trả về chuỗi gốc hoặc giá trị lỗi
        return value; // Hoặc 'N/A' hoặc null
      }
      numberValue = parsed; // Sử dụng giá trị số đã parse
    }
    // 3. Nếu là number, giữ nguyên
    else {
      numberValue = value;
    }

    // 4. Sử dụng DecimalPipe gốc để format
    try {
      return this.decimalPipe.transform(numberValue, digitsInfo, locale);
    } catch (e) {
      console.error(`FormatBigDecimalPipe: Error formatting value "${numberValue}" with digitsInfo "${digitsInfo}" and locale "${locale || this.locale}":`, e);
      // Trả về giá trị gốc hoặc giá trị lỗi nếu format thất bại
      return String(numberValue); // Chuyển về string cơ bản
    }
  }
}
