import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatListComponent } from '../chat-list/chat-list.component'; // Import list
import { MessageAreaComponent } from '../message-area/message-area.component'; // Import message area
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { ChatService } from '../../../service/ChatService'; // Import service
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, ChatListComponent, MessageAreaComponent],
  templateUrl: './chat-layout.component.html',
})
export class ChatLayoutComponent implements OnDestroy {
  private chatService = inject(ChatService);
  private destroy$ = new Subject<void>();

  // Signal để lưu phòng chat đang được chọn
  selectedRoom = signal<ChatRoomResponse | null>(null);
  showMobileChatList = signal(true); // Biến để ẩn/hiện list trên mobile

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Reset phòng đang chọn khi rời khỏi layout chat
    this.chatService.setCurrentChatRoom(null); // Cần thêm hàm này vào ChatService
  }

  onRoomSelected(room: ChatRoomResponse): void {
    console.log('Room selected:', room);
    this.selectedRoom.set(room);
    this.showMobileChatList.set(false); // Ẩn list khi chọn phòng trên mobile
    this.chatService.setCurrentChatRoom(room.id); // Báo cho service biết phòng nào đang mở
    // Đánh dấu đã đọc khi chọn phòng
    if (room.myUnreadCount && room.myUnreadCount > 0) {
      this.chatService.markMessagesAsRead(room.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          // next: () => console.log(`Marked room ${room.id} as read`),
          error: (err) => console.error("Error marking room as read", err)
        });
    }
  }

  // Hàm để quay lại danh sách chat trên mobile
  backToChatList(): void {
    this.selectedRoom.set(null);
    this.showMobileChatList.set(true);
    this.chatService.setCurrentChatRoom(null);
  }
}
// Cần thêm hàm setCurrentChatRoom(roomId: number | null) vào ChatService
// để ChatService biết phòng nào đang mở và xử lý unread count/thông báo chính xác hơn.
