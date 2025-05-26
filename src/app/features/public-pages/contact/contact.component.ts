import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms'; // Import ReactiveFormsModule
import { ToastrService } from 'ngx-toastr'; // Import ToastrService

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule], // Thêm ReactiveFormsModule
  templateUrl: './contact.component.html',
})
export class ContactComponent {
  private fb = inject(FormBuilder);
  private toastr = inject(ToastrService);

  contactForm = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', Validators.required],
    message: ['', [Validators.required, Validators.minLength(10)]]
  });

  isSubmitting = false;

  constructor() { }

  onSubmit(): void {
    if (this.contactForm.invalid) {
      this.contactForm.markAllAsTouched();
      this.toastr.error('Vui lòng điền đầy đủ thông tin vào các trường bắt buộc.', 'Lỗi');
      return;
    }

    this.isSubmitting = true;
    // TODO: Xử lý gửi form liên hệ (ví dụ: gọi API)
    console.log('Contact Form Data:', this.contactForm.value);

    // Giả lập gửi thành công
    setTimeout(() => {
      this.toastr.success('Cảm ơn bạn đã liên hệ! Chúng tôi sẽ phản hồi sớm nhất có thể.', 'Gửi thành công');
      this.contactForm.reset();
      this.isSubmitting = false;
    }, 1500);
  }
}
