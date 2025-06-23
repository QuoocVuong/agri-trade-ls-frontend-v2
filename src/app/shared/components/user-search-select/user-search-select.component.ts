
import {Component, EventEmitter, Input, Output, inject, signal, OnChanges, SimpleChanges} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import {of, Subject} from 'rxjs';
import {debounceTime, distinctUntilChanged, switchMap, filter, catchError} from 'rxjs/operators';

import { UserResponse } from '../../../features/user-profile/dto/response/UserResponse';

import {UserProfileService} from '../../../features/user-profile/services/user-profile.service';
import {PagedApiResponse} from '../../../core/models/api-response.model';


@Component({
  selector: 'app-user-search-select',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule], // Thêm FormsModule
  template: `
    <div class="relative">
      <input type="text"
             [(ngModel)]="searchTerm"
             (ngModelChange)="onSearchTermChange($event)"
             placeholder="Tìm người mua theo tên hoặc email..."
             class="input input-bordered input-sm w-full"
             (focus)="showDropdown.set(true)"
             (blur)="onInputBlur()">
      <div *ngIf="showDropdown() && (foundUsers().length > 0 || isLoading())"
           class="absolute z-10 w-full bg-base-100 dark:bg-gray-700 shadow-lg rounded-md mt-1 max-h-60 overflow-y-auto">
        <div *ngIf="isLoading()" class="p-2 text-center text-xs">Đang tìm...</div>
        <ul>
          <li *ngFor="let user of foundUsers()"
              (click)="selectUser(user)"
              class="px-3 py-2 hover:bg-base-200 dark:hover:bg-gray-600 cursor-pointer text-sm">
            {{ user.fullName }} ({{ user.email }})
          </li>
        </ul>
      </div>
      <div *ngIf="showDropdown() && foundUsers().length === 0 && !isLoading() && searchTerm.length > 2"
           class="absolute z-10 w-full bg-base-100 dark:bg-gray-700 shadow-lg rounded-md mt-1 p-2 text-center text-xs">
        Không tìm thấy người dùng.
      </div>
    </div>
  `
})
export class UserSearchSelectComponent implements OnChanges {
  @Input() initialUser: UserResponse | null = null;
  @Output() userSelected = new EventEmitter<UserResponse | null>();

  private userProfileService = inject(UserProfileService);
  searchTerm = '';
  private searchSubject = new Subject<string>();

  foundUsers = signal<UserResponse[]>([]);
  isLoading = signal(false);
  showDropdown = signal(false);

  constructor() {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      filter(term => term.length > 2 || term.length === 0), // Tìm khi > 2 ký tự hoặc khi xóa hết
      switchMap(term => {
        if (term.length === 0 && this.initialUser?.fullName !== '') { // Sửa điều kiện này
          this.foundUsers.set([]);
          return of(null);
        }
        if (term.length < 2 && term.length !==0) { // Chỉ tìm khi >= 2 ký tự, trừ khi xóa hết
          this.foundUsers.set([]);
          return of(null);
        }
        this.isLoading.set(true);

        return this.userProfileService.searchBuyers(term, 0, 10 ) // PageRequest nếu cần
          .pipe(
            catchError(() => {
              this.isLoading.set(false);
              this.foundUsers.set([]);
              return of(null);
            })
          );
      })
    ).subscribe((response: PagedApiResponse<UserResponse> | null) => {
      this.isLoading.set(false);
      if (response && response.success && response.data) {
        this.foundUsers.set(response.data.content);
      } else {
        this.foundUsers.set([]);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['initialUser'] && this.initialUser) {
      this.searchTerm = this.initialUser.fullName || this.initialUser.email || '';
    } else if (changes['initialUser'] && !this.initialUser) {
      this.searchTerm = ''; // Reset nếu initialUser bị xóa
    }
  }

  onSearchTermChange(term: string): void {
    this.searchSubject.next(term);
    if (!term) {
      this.userSelected.emit(null); // Xóa lựa chọn nếu xóa hết text
    }
  }

  selectUser(user: UserResponse): void {
    this.searchTerm = user.fullName || user.email;
    this.userSelected.emit(user);
    this.showDropdown.set(false);
    this.foundUsers.set([]);
  }

  onInputBlur(): void {
    // Delay một chút để sự kiện click trên dropdown kịp xử lý
    setTimeout(() => this.showDropdown.set(false), 150);
  }
}
