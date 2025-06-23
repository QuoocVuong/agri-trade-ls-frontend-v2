import {
  Component,
  OnInit,
  inject,
  signal,
  Output,
  EventEmitter,
  OnDestroy,
  computed,
  ChangeDetectorRef, ChangeDetectionStrategy
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ChatService } from '../../../service/ChatService';
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { LoadingSpinnerComponent } from '../../../../../shared/components/loading-spinner/loading-spinner.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {AuthService} from '../../../../../core/services/auth.service';
import {TimeAgoPipe} from '../../../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, DatePipe, TimeAgoPipe],
  templateUrl: './chat-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatListComponent implements OnInit, OnDestroy {
  @Output() roomSelected = new EventEmitter<ChatRoomResponse>();
  public chatService = inject(ChatService);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  chatRooms = signal<ChatRoomResponse[]>([]);
  isLoading = this.chatService.isLoadingRooms; // Lấy signal loading từ service
  selectedRoomId = signal<number | null>(null); // Phòng đang được chọn

  // Lấy ID user hiện tại từ AuthService
  readonly currentUserId = computed(() => this.authService.currentUser()?.id);

  ngOnInit(): void {
    // Subscribe vào danh sách phòng chat từ service
    this.chatService.chatRooms$
      .pipe(takeUntil(this.destroy$))
      .subscribe(rooms => {
        this.chatRooms.set(rooms || []);
        this.cdr.markForCheck();
      });


  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  selectRoom(room: ChatRoomResponse): void {
    this.selectedRoomId.set(room.id);
    this.roomSelected.emit(room);
  }

  trackRoomById(index: number, room: ChatRoomResponse): number {
    return room.id;
  }
}
