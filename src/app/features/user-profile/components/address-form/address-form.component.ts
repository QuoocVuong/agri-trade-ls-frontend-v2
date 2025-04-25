import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UserProfileService } from '../../services/user-profile.service';
import { Address } from '../../domain/address.model'; // Giả sử Address model vẫn dùng provinceCode, districtCode, wardCode
import { AddressRequest } from '../../dto/request/AddressRequest';
import { ApiResponse } from '../../../../core/models/api-response.model';
import { LocationService, Province, District, Ward } from '../../../../core/services/location.service'; // Import LocationService và models đã cập nhật
import { Observable, of, firstValueFrom } from 'rxjs'; // Import firstValueFrom để chờ async/await
import { ToastrService } from 'ngx-toastr';
import {AlertComponent} from '../../../../shared/components/alert/alert.component';
import {AddressResponse} from '../../dto/response/AddressResponse'; // Import Toastr

@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent], // Đảm bảo ReactiveFormsModule được import
  templateUrl: './address-form.component.html',
})
export class AddressFormComponent implements OnInit, OnChanges {
  @Input() addressToEdit: Address | null = null;
  @Output() addressSaved = new EventEmitter<Address>();
  @Output() cancelled = new EventEmitter<void>();
  // *** KHAI BÁO INPUT ***
  @Input() initialAddress: Address | null = null; // Input để nhận địa chỉ cần sửa


  private fb = inject(FormBuilder);
  private userProfileService = inject(UserProfileService);
  private locationService = inject(LocationService);
  private toastr = inject(ToastrService); // Inject Toastr

  addressForm!: FormGroup;
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Sử dụng Observable cho danh sách địa giới
  provinces$: Observable<Province[]> = of([]);
  districts$: Observable<District[]> = of([]);
  wards$: Observable<Ward[]> = of([]);

  ngOnInit(): void {
    this.initForm();
    this.provinces$ = this.locationService.getProvinces();
    // Gọi patchFormWithLocationData trong ngOnChanges khi addressToEdit thay đổi lần đầu
  }

  // ngOnChanges(changes: SimpleChanges): void {
  //   if (changes['addressToEdit'] && this.addressForm) {
  //     // Cần đảm bảo provinces$ đã load xong trước khi patch (hoặc xử lý bất đồng bộ)
  //     // Cách đơn giản là gọi patch sau khi load tỉnh ở ngOnInit nếu là edit mode ban đầu
  //     // Hoặc gọi lại patchFormWithLocationData ở đây
  //     this.patchFormWithLocationData();
  //   }
  // }
  ngOnChanges(changes: SimpleChanges): void {
    // *** SỬA Ở ĐÂY: Kiểm tra input 'initialAddress' ***
    if (changes['initialAddress'] && this.addressForm) {
      this.patchFormWithLocationData();
    }
  }

  private initForm(): void {
    this.addressForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.maxLength(100)]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^(84|0)(3|5|7|8|9)[0-9]{8}$/), Validators.maxLength(20)]],
      addressDetail: ['', [Validators.required, Validators.maxLength(255)]],
      // Các control này vẫn lưu code (ví dụ: '12', '121', '12101')
      provinceCode: [null, Validators.required],
      districtCode: [{ value: null, disabled: true }, Validators.required],
      wardCode: [{ value: null, disabled: true }, Validators.required],
      isDefault: [false]
    });

    // Lắng nghe sự thay đổi của tỉnh để load huyện
    this.addressForm.get('provinceCode')?.valueChanges.subscribe(provinceCode => {
      this.addressForm.get('districtCode')?.reset(null);
      this.addressForm.get('districtCode')?.disable();
      this.addressForm.get('wardCode')?.reset(null);
      this.addressForm.get('wardCode')?.disable();
      this.districts$ = of([]);
      this.wards$ = of([]);
      if (provinceCode) {
        this.districts$ = this.locationService.getDistricts(provinceCode);
        this.addressForm.get('districtCode')?.enable();
      }
    });

    // Lắng nghe sự thay đổi của huyện để load xã
    this.addressForm.get('districtCode')?.valueChanges.subscribe(districtCode => {
      this.addressForm.get('wardCode')?.reset(null);
      this.addressForm.get('wardCode')?.disable();
      this.wards$ = of([]);
      if (districtCode) {
        this.wards$ = this.locationService.getWards(districtCode);
        this.addressForm.get('wardCode')?.enable();
      }
    });
  }

  // Patch form, cần xử lý bất đồng bộ khi load huyện/xã
  private async patchFormWithLocationData(): Promise<void> {
    // if (this.addressToEdit) {
    //   const address = this.addressToEdit;
    if (this.initialAddress) {
      const address = this.initialAddress; // <-- Dùng initialAddress
      // Patch các trường không phụ thuộc địa giới trước
      this.addressForm.patchValue({
        fullName: address.fullName,
        phoneNumber: address.phoneNumber,
        addressDetail: address.addressDetail,
        provinceCode: address.provinceCode, // Patch province code
        isDefault: address.isDefault,
      }, { emitEvent: false }); // Không trigger valueChanges ngay

      // Load huyện dựa trên provinceCode đã patch
      if (address.provinceCode) {
        this.districts$ = this.locationService.getDistricts(address.provinceCode);
        this.addressForm.get('districtCode')?.enable();
        try {
          await firstValueFrom(this.districts$); // Chờ load huyện xong
          // Patch district code sau khi đã có danh sách huyện
          this.addressForm.patchValue({ districtCode: address.districtCode }, { emitEvent: false });

          // Load xã dựa trên districtCode đã patch
          if (address.districtCode) {
            this.wards$ = this.locationService.getWards(address.districtCode);
            this.addressForm.get('wardCode')?.enable();
            await firstValueFrom(this.wards$); // Chờ load xã xong
            // Patch ward code sau khi đã có danh sách xã
            this.addressForm.patchValue({ wardCode: address.wardCode }, { emitEvent: false });
          } else {
            this.addressForm.get('wardCode')?.disable();
            this.wards$ = of([]);
          }
        } catch (e) {
          console.error("Error loading districts/wards during patch", e);
          this.errorMessage.set("Lỗi tải dữ liệu Quận/Huyện hoặc Phường/Xã.");
        }
      } else {
        this.addressForm.get('districtCode')?.disable();
        this.addressForm.get('wardCode')?.disable();
        this.districts$ = of([]);
        this.wards$ = of([]);
      }
    } else {
      // Reset form cho trường hợp thêm mới
      this.addressForm.reset({ isDefault: false, provinceCode: null, districtCode: null, wardCode: null });
      this.addressForm.get('districtCode')?.disable();
      this.addressForm.get('wardCode')?.disable();
      this.districts$ = of([]);
      this.wards$ = of([]);
    }
    this.addressForm.markAsPristine(); // Đánh dấu form chưa thay đổi sau khi patch
  }


  onSubmit(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      this.toastr.warning('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    // Lấy giá trị từ form (bao gồm cả control bị disable như provinceCode)
    const requestData: AddressRequest = this.addressForm.getRawValue();
    // let apiCall: Observable<ApiResponse<Address>>;
    let apiCall: Observable<ApiResponse<AddressResponse>>; // Service trả về AddressResponse

    // if (this.addressToEdit && this.addressToEdit.id) {
    //   apiCall = this.userProfileService.updateAddress(this.addressToEdit.id, requestData);
    if (this.initialAddress && this.initialAddress.id) {
      apiCall = this.userProfileService.updateAddress(this.initialAddress.id, requestData);
    } else {
      apiCall = this.userProfileService.addAddress(requestData);
    }

    apiCall.subscribe({
      next: (response: ApiResponse<AddressResponse>) => {
        if (response.success && response.data) {
        //   this.toastr.success(this.addressToEdit ? 'Cập nhật địa chỉ thành công!' : 'Thêm địa chỉ thành công!');
        //   this.addressSaved.emit(response.data); // Gửi sự kiện lưu thành công
        // } else {
          this.toastr.success(this.initialAddress ? 'Cập nhật địa chỉ thành công!' : 'Thêm địa chỉ thành công!');
          // *** SỬA KIỂU DỮ LIỆU EMIT: Cần map AddressResponse sang Address nếu cần ***
          // Hoặc thay đổi kiểu của EventEmitter thành AddressResponse
          // Tạm thời giả sử Address và AddressResponse giống nhau:
          this.addressSaved.emit(response.data as any); // <-- Ép kiểu tạm thời, cần xem xét lại
        } else {
          this.errorMessage.set(response.message || 'Lưu địa chỉ thất bại.');
          this.toastr.error(response.message || 'Lưu địa chỉ thất bại.');
        }
        this.isLoading.set(false);
      },
      error: (err: ApiResponse<null> | any) => { // Xử lý cả HttpErrorResponse
        const message = err?.message || 'Đã xảy ra lỗi khi lưu địa chỉ.';
        this.errorMessage.set(message);
        this.toastr.error(message);
        this.isLoading.set(false);
      }
    });
  }

  onCancel(): void {
    this.cancelled.emit(); // Gửi sự kiện hủy
  }
}
