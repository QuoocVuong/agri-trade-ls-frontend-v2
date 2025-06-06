// src/app/features/user-profile/components/my-sent-supply-requests/my-sent-supply-requests.component.ts
import { Component, OnInit, inject, signal, OnDestroy, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';

import { SupplyOrderRequestService } from '../../../ordering/services/supply-order-request.service';
import { SupplyOrderRequestResponse } from '../../../ordering/dto/response/SupplyOrderRequestResponse';
import { PageData, PagedApiResponse } from '../../../../core/models/api-response.model';
import { SupplyOrderRequestStatus, getSupplyOrderRequestStatusText } from '../../../ordering/domain/supply-order-request-status.enum';

import { LoadingSpinnerComponent } from '../../../../shared/components/loading-spinner/loading-spinner.component';
import { AlertComponent } from '../../../../shared/components/alert/alert.component';
import { PaginatorComponent } from '../../../../shared/components/paginator/paginator.component';
import { FormatBigDecimalPipe } from '../../../../shared/pipes/format-big-decimal.pipe';
import { TimeAgoPipe } from '../../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-my-sent-supply-requests',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LoadingSpinnerComponent,
    AlertComponent,
    PaginatorComponent,
    DatePipe,
    FormatBigDecimalPipe,
    TimeAgoPipe
  ],
  templateUrl: './my-sent-supply-requests.component.html',
})
export class MySentSupplyRequestsComponent implements OnInit, OnDestroy {
  private requestService = inject(SupplyOrderRequestService);
  private destroy$ = new Subject<void>();

  requestsPage = signal<PageData<SupplyOrderRequestResponse> | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  currentPage = signal(0);
  pageSize = signal(10);
  sort = signal('createdAt,desc');

  getStatusText = getSupplyOrderRequestStatusText;
  RequestStatusEnum = SupplyOrderRequestStatus;


  constructor() {
    effect(() => {
      this.loadSentRequests();
    });
  }

  ngOnInit(): void {
    // Load lần đầu
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSentRequests(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.requestService.getMySentRequests(this.currentPage(), this.pageSize(), this.sort())
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.requestsPage.set(res.data);
          } else {
            this.requestsPage.set(null);
            this.errorMessage.set(res.message || 'Không tải được danh sách yêu cầu đã gửi.');
          }
        },
        error: (err) => {
          this.requestsPage.set(null);
          this.errorMessage.set(err.error?.message || 'Lỗi khi tải danh sách yêu cầu.');
        }
      });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
  }

  trackRequestById(index: number, item: SupplyOrderRequestResponse): number {
    return item.id;
  }
}
