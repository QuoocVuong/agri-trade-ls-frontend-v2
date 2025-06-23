import { Component, OnInit, inject, signal, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FollowService } from '../../service/FollowService';
import { FollowUserResponse } from '../../dto/response/FollowUserResponse';
import { Page } from '../../../../core/models/page.model';
import { PagedApiResponse } from '../../../../core/models/api-response.model';
import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';

import {Observable} from 'rxjs';

type FollowListMode = 'my-following' | 'my-followers' | 'user-followers';

@Component({
  selector: 'app-follow-list',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingSpinnerComponent, AlertComponent, PaginatorComponent],
  templateUrl: './follow-list.component.html',
})
export class FollowListComponent implements OnInit {
  // Input để xác định chế độ hiển thị và user ID (nếu xem của người khác)
  @Input() mode: FollowListMode = 'my-following'; // Mặc định xem người mình đang theo dõi
  @Input() userId?: number | null; // ID của user cần xem followers (nếu mode='user-followers')

  private followService = inject(FollowService);

  private route = inject(ActivatedRoute); // Có thể dùng để lấy userId từ route nếu cần

  usersPage = signal<Page<FollowUserResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  listTitle = signal('Danh sách'); // Tiêu đề động

  // Phân trang
  currentPage = signal(0);
  pageSize = signal(20);
  sort = signal('followedAt,desc'); // Hoặc sắp xếp theo tên...

  ngOnInit(): void {
    // Lấy userId từ Input hoặc từ route nếu cần cho mode 'user-followers'
    if (this.mode === 'user-followers' && !this.userId) {
      // Ví dụ lấy từ route param 'id'
      this.userId = +this.route.snapshot.paramMap.get('id')!; // Dùng ! nếu chắc chắn có param
      if (!this.userId) {
        this.errorMessage.set("Thiếu ID người dùng để xem danh sách theo dõi.");
        this.isLoading.set(false);
        return;
      }
    }
    this.updateTitle(); // Cập nhật tiêu đề dựa trên mode
    this.loadUsers();
  }

  updateTitle(): void {
    switch(this.mode) {
      case 'my-following': this.listTitle.set('Đang theo dõi'); break;
      case 'my-followers': this.listTitle.set('Người theo dõi bạn'); break;
      case 'user-followers': this.listTitle.set('Người theo dõi'); break;
    }
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const page = this.currentPage();
    const size = this.pageSize();
    const sort = this.sort();

    let apiCall: Observable<PagedApiResponse<FollowUserResponse>>;

    switch (this.mode) {
      case 'my-following':
        apiCall = this.followService.getMyFollowing(page, size, sort);
        break;
      case 'my-followers':
        apiCall = this.followService.getMyFollowers(page, size, sort);
        break;
      case 'user-followers':
        if (!this.userId) {
          this.errorMessage.set("Thiếu ID người dùng.");
          this.isLoading.set(false);
          return; // Nên return Observable lỗi hoặc trống
        }
        apiCall = this.followService.getFollowersPublic(this.userId, page, size, sort);
        break;
      default:
        this.errorMessage.set('Chế độ xem danh sách không hợp lệ.');
        this.isLoading.set(false);
        return;
    }

    apiCall.subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.usersPage.set(response.data);
        } else {
          this.usersPage.set(null);
          if(response.status !== 404 && !response.success) this.errorMessage.set(response.message || 'Không tải được danh sách.');
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.usersPage.set(null);
        this.errorMessage.set(err.message || 'Đã xảy ra lỗi.');
        this.isLoading.set(false);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadUsers();
  }

  trackUserById(index: number, item: FollowUserResponse): number {
    return item.userId;
  }


}
