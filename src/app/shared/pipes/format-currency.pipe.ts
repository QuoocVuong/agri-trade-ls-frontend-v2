import { Pipe, PipeTransform, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import  BigDecimal  from 'js-big-decimal'; // Import nếu cần xử lý BigDecimal

@Pipe({
  name: 'formatCurrency',
  standalone: true,
})
export class FormatCurrencyPipe implements PipeTransform {
  private decimalPipe = new DecimalPipe('vi-VN'); // Sử dụng locale vi-VN

  transform(
    value: number | string | BigDecimal | null | undefined,
    currencySymbol: string = 'đ', // Mặc định là 'đ'
    symbolPosition: 'start' | 'end' = 'end', // Vị trí ký hiệu tiền tệ
    digitsInfo: string = '1.0-0' // Format số (không có phần thập phân)
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    let numberValue: number | string;
    if (value instanceof BigDecimal) {
      numberValue = value.toString(); // Chuyển BigDecimal thành string
    } else {
      numberValue = value;
    }

    // Dùng DecimalPipe gốc để format số
    const formattedNumber = this.decimalPipe.transform(numberValue, digitsInfo);

    if (formattedNumber === null) {
      return null;
    }

    // Thêm ký hiệu tiền tệ
    return symbolPosition === 'start'
      ? `${currencySymbol} ${formattedNumber}`
      : `${formattedNumber} ${currencySymbol}`;
  }
}
