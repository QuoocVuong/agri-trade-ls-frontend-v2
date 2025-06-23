import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';

@Component({
  selector: 'app-vnpay-result',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSpinnerComponent],
  templateUrl: './vnpay-result.component.html',

})
export class VnpayResultComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toastr = inject(ToastrService);

  isLoading = signal(true);
  paymentStatusMessage = signal('Đang xử lý kết quả thanh toán của bạn...');
  isSuccess = signal<boolean | null>(null);
  orderCode = signal<string | null>(null);
  transactionNo = signal<string | null>(null); // Mã giao dịch VNPAY
  vnpMessage = signal<string | null>(null); // Thông báo từ VNPAY



  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.isLoading.set(false);
      console.log('VNPay Return URL Params:', params);

      this.orderCode.set(params['vnp_TxnRef']);
      this.transactionNo.set(params['vnp_TransactionNo']);
      const responseCode = params['vnp_ResponseCode'];
      const vnpMessageParam = params['vnp_Message'];

      try {
        this.vnpMessage.set(vnpMessageParam ? decodeURIComponent(vnpMessageParam.replace(/\+/g, ' ')) : null);
      } catch (e) {
        this.vnpMessage.set(vnpMessageParam); // Để nguyên nếu không decode được
        console.error("Error decoding vnp_Message:", e);
      }


      if (responseCode === '00') {
        this.isSuccess.set(true);
        this.paymentStatusMessage.set('Thanh toán qua VNPAY thành công!');
        this.toastr.success('Giao dịch của bạn đã được ghi nhận. Trạng thái đơn hàng sẽ sớm được cập nhật.', 'Thanh toán thành công');
        // Không cập nhật trạng thái đơn hàng ở đây. Chờ IPN từ server.
      } else {
        this.isSuccess.set(false);
        const specificError = this.getVnpayErrorMessage(responseCode);
        this.paymentStatusMessage.set(`Thanh toán qua VNPAY thất bại. ${specificError}`);
        this.toastr.error(`Lý do: ${specificError} (Mã lỗi: ${responseCode})`, 'Thanh toán thất bại');
      }


    });
  }

  // Hàm dịch mã lỗi VNPAY
  private getVnpayErrorMessage(responseCode: string): string {

    switch (responseCode) {
      case '07': return 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).';
      case '09': return 'Thẻ/Tài khoản của khách hàng chưa đăng ký VNPAY Payment.';
      case '10': return 'Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần.';
      case '11': return 'Đã hết hạn chờ thanh toán. Xin vui lòng thực hiện lại giao dịch.';
      case '12': return 'Thẻ/Tài khoản của khách hàng bị khóa.';
      case '13': return 'Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin vui lòng thực hiện lại giao dịch.';
      case '24': return 'Khách hàng hủy giao dịch.';
      case '51': return 'Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.';
      case '65': return 'Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.';
      case '75': return 'Ngân hàng thanh toán đang bảo trì.';
      case '79': return 'KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin vui lòng thực hiện lại giao dịch';
      // ... thêm các mã lỗi khác ...
      default: return this.vnpMessage() || 'Giao dịch không thành công. Vui lòng liên hệ nhà cung cấp dịch vụ.';
    }
  }

  navigateToOrderDetails(): void {

    this.router.navigate(['/user/orders']);

  }
}
