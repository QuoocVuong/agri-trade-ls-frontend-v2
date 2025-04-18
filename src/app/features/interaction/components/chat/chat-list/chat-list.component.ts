import {Component, OnInit, inject, signal, Output, EventEmitter, OnDestroy, computed} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ChatService } from '../../../service/ChatService';
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { LoadingSpinnerComponent } from '../../../../../shared/components/loading-spinner/loading-spinner.component';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {AuthService} from '../../../../../core/services/auth.service';

@Component({
  selector: 'app-chat-list',
  standalone: true,
  imports: [CommonModule, LoadingSpinnerComponent, DatePipe],
  templateUrl: './chat-list.component.html',
})
export class ChatListComponent implements OnInit, OnDestroy {
  @Output() roomSelected = new EventEmitter<ChatRoomResponse>();
  private chatService = inject(ChatService);
  private destroy$ = new Subject<void>();
  private authService = inject(AuthService);

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
      });
    // Có thể gọi loadMyChatRooms ở đây nếu service không tự load khi login
    // this.chatService.loadMyChatRooms().subscribe();
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
