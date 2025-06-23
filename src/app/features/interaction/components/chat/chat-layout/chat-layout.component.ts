import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatListComponent } from '../chat-list/chat-list.component';
import { MessageAreaComponent } from '../message-area/message-area.component';
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { ChatService } from '../../../service/ChatService';
import { Subject } from 'rxjs';

import {ActivatedRoute, Router} from '@angular/router';



@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, ChatListComponent, MessageAreaComponent],
  templateUrl: './chat-layout.component.html',
})
export class ChatLayoutComponent implements OnDestroy {
  private chatService = inject(ChatService);
  private destroy$ = new Subject<void>();
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Signal để lưu phòng chat đang được chọn
  selectedRoom = signal<ChatRoomResponse | null>(null);
  showMobileChatList = signal(true); // Biến để ẩn/hiện list trên mobile



  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

  }

  onRoomSelected(room: ChatRoomResponse): void {
    this.selectedRoom.set(room);
    this.showMobileChatList.set(false);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { roomId: room.id },
      queryParamsHandling: 'merge'
    });

    // Logic đánh dấu đã đọc giữ nguyên
    if (room.myUnreadCount && room.myUnreadCount > 0) {
      this.chatService.markMessagesAsRead(room.id).subscribe();
    }
  }


  // Hàm để quay lại danh sách chat trên mobile
  backToChatList(): void {
    this.clearSelectedRoom();
  }



  private clearSelectedRoom(): void {
    this.selectedRoom.set(null);
    this.showMobileChatList.set(true);


    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { roomId: null },
      queryParamsHandling: 'merge'
    });
  }
}

