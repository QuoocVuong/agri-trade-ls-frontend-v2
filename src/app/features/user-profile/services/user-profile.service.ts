import { Injectable, inject } from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import {ApiResponse, PagedApiResponse} from '../../../core/models/api-response.model';

import { UserProfileResponse } from '../dto/response/UserProfileResponse';
import { UserUpdateRequest } from '../dto/request/UserUpdateRequest';
import { PasswordChangeRequest } from '../dto/request/PasswordChangeRequest';
import { AddressResponse } from '../dto/response/AddressResponse';
import { AddressRequest } from '../dto/request/AddressRequest';
import { FarmerProfileRequest } from '../dto/request/FarmerProfileRequest';
import { FarmerProfileResponse } from '../dto/response/FarmerProfileResponse';
import { BusinessProfileRequest } from '../dto/request/BusinessProfileRequest';
import { BusinessProfileResponse } from '../dto/response/BusinessProfileResponse';
import {UserResponse} from '../dto/response/UserResponse';
import {RoleType} from '../../../common/model/role-type.enum';


@Injectable({
  providedIn: 'root' // Cung cấp ở root nếu nhiều module cần, hoặc chỉ trong module user-profile
})
export class UserProfileService {
  private http = inject(HttpClient);
  private userApiUrl = `${environment.apiUrl}/users`; // API quản lý user chung
  private farmerProfileApiUrl = `${environment.apiUrl}/profiles/farmer`;
  private businessProfileApiUrl = `${environment.apiUrl}/profiles/business`;
  private addressApiUrl = `${environment.apiUrl}/addresses`; // Giả sử có API riêng cho địa chỉ

  private adminUserApiUrl = `${environment.apiUrl}/admin/users`;

  // Lấy profile đầy đủ của user đang đăng nhập
  getMyProfile(): Observable<ApiResponse<UserProfileResponse>> {
    return this.http.get<ApiResponse<UserProfileResponse>>(`${this.userApiUrl}/me/profile`);
  }

  // Cập nhật thông tin cơ bản của user đang đăng nhập
  updateMyProfile(data: UserUpdateRequest): Observable<ApiResponse<UserResponse>> {
    return this.http.put<ApiResponse<UserResponse>>(`${this.userApiUrl}/me`, data);
  }

  // Đổi mật khẩu
  changePassword(data: PasswordChangeRequest): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.userApiUrl}/me/password`, data);
  }

  // --- Quản lý Địa chỉ ---
  getMyAddresses(): Observable<ApiResponse<AddressResponse[]>> {
    return this.http.get<ApiResponse<AddressResponse[]>>(`${this.addressApiUrl}/my`); // API lấy địa chỉ của tôi
  }

  addAddress(data: AddressRequest): Observable<ApiResponse<AddressResponse>> {
    return this.http.post<ApiResponse<AddressResponse>>(`${this.addressApiUrl}/my`, data); // API thêm địa chỉ
  }

  updateAddress(id: number, data: AddressRequest): Observable<ApiResponse<AddressResponse>> {
    return this.http.put<ApiResponse<AddressResponse>>(`${this.addressApiUrl}/my/${id}`, data); // API sửa địa chỉ
  }

  deleteAddress(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.addressApiUrl}/my/${id}`); // API xóa địa chỉ
  }

  setDefaultAddress(id: number): Observable<ApiResponse<void>> {
    return this.http.put<ApiResponse<void>>(`${this.addressApiUrl}/my/${id}/default`, {}); // API đặt mặc định
  }

  // --- Đăng ký/Cập nhật Profile Farmer/Business ---
  createOrUpdateFarmerProfile(data: FarmerProfileRequest): Observable<ApiResponse<FarmerProfileResponse>> {
    return this.http.put<ApiResponse<FarmerProfileResponse>>(`${this.farmerProfileApiUrl}/me`, data);
  }

  createOrUpdateBusinessProfile(data: BusinessProfileRequest): Observable<ApiResponse<BusinessProfileResponse>> {
    return this.http.put<ApiResponse<BusinessProfileResponse>>(`${this.businessProfileApiUrl}/me`, data);
  }

  // Có thể thêm các hàm lấy profile public của farmer/business khác ở đây nếu cần

  // ---  PHƯƠNG THỨC MỚI ĐỂ TÌM USER CHO SELECTION ---
  searchUsersForSelection(keyword: string, roles: RoleType[], page: number = 0, size: number = 10): Observable<PagedApiResponse<UserResponse>> {
    let params = new HttpParams()
      .set('keyword', keyword)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('isActive', 'true'); // Chỉ tìm user đang active


    if (roles && roles.length > 0) {
      params = params.set('roles', roles.join(',')); // Hoặc cách API backend của bạn nhận nhiều role
    }
    // API này có thể cần quyền Admin, hoặc một API public riêng để tìm user (ít bảo mật hơn)
    // Hiện tại, giả sử dùng API của Admin
    return this.http.get<PagedApiResponse<UserResponse>>(this.adminUserApiUrl, { params });
  }
  // ----------------------------------------------------

  getDefaultAddress(userId: number): Observable<ApiResponse<AddressResponse | null>> {

    return this.http.get<ApiResponse<AddressResponse | null>>(`${this.addressApiUrl}/user/${userId}/default`);

  }

  searchBuyers(keyword: string,  page: number, size: number, sort?: string): Observable<PagedApiResponse<UserResponse>> {
    let params = new HttpParams()
      .set('keyword', keyword)
      .set('page', page.toString())
      .set('size', size.toString())
      .set('isActive', 'true'); // Chỉ tìm user đang active
    if (sort) {
      params = params.set('sort', sort);
    }
    // Gọi API mới đã tạo ở backend
    return this.http.get<PagedApiResponse<UserResponse>>(`${this.userApiUrl}/search-buyers`, { params });
  }

}
