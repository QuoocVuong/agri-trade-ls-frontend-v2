import { Component, inject, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChatListComponent } from '../chat-list/chat-list.component'; // Import list
import { MessageAreaComponent } from '../message-area/message-area.component'; // Import message area
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { ChatService } from '../../../service/ChatService'; // Import service
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {ActivatedRoute, Router} from '@angular/router';

const SELECTED_ROOM_ID_KEY = 'selectedChatRoomId';

@Component({
  selector: 'app-chat-layout',
  standalone: true,
  imports: [CommonModule, ChatListComponent, MessageAreaComponent],
  templateUrl: './chat-layout.component.html',
})
export class ChatLayoutComponent implements OnDestroy {
  private chatService = inject(ChatService);
  private destroy$ = new Subject<void>();
  private router = inject(Router); // Inject Router
  private route = inject(ActivatedRoute); // Inject ActivatedRoute

  // Signal để lưu phòng chat đang được chọn
  selectedRoom = signal<ChatRoomResponse | null>(null);
  showMobileChatList = signal(true); // Biến để ẩn/hiện list trên mobile

  ngOnInit(): void {
    // Khôi phục phòng đã chọn từ sessionStorage hoặc query params khi component init
    this.restoreSelectedRoom();

    // Lắng nghe danh sách phòng chat để tìm thông tin phòng đã khôi phục
    this.chatService.chatRooms$
      .pipe(takeUntil(this.destroy$))
      .subscribe(rooms => {
        const restoredRoomId = this.selectedRoom()?.id; // Lấy ID đã khôi phục (nếu có)
        if (restoredRoomId && rooms && rooms.length > 0) {
          const foundRoom = rooms.find(r => r.id === restoredRoomId);
          if (foundRoom) {
            // Cập nhật lại signal với đầy đủ thông tin
            this.selectedRoom.set(foundRoom);
          } else {
            // Nếu ID đã lưu không còn tồn tại trong danh sách mới -> reset
            this.clearSelectedRoom();
          }
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Không cần reset ở đây nữa vì sẽ làm khi component init lại
    //this.chatService.setCurrentChatRoom(null); // Cần thêm hàm này vào ChatService
  }

  onRoomSelected(room: ChatRoomResponse): void {
    this.selectedRoom.set(room);
    this.showMobileChatList.set(false);

    // *** CẬP NHẬT URL KHI CHỌN PHÒNG ***
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

  private restoreSelectedRoom(): void {
    const queryRoomId = this.route.snapshot.queryParamMap.get('roomId');
    const roomIdToRestore = queryRoomId ? +queryRoomId : null;


    if (roomIdToRestore) {
      console.log("Restoring selected room ID from URL:", roomIdToRestore);
      // Không cần gọi API ở đây. Chỉ cần set ID tạm thời.
      // `chatRooms$` subscription ở trên sẽ tìm và điền đầy đủ thông tin sau.
      this.selectedRoom.set({ id: roomIdToRestore } as ChatRoomResponse);
      this.showMobileChatList.set(false);
    } else {
      this.selectedRoom.set(null);
      this.showMobileChatList.set(true);
    }
  }

  private clearSelectedRoom(): void {
    this.selectedRoom.set(null);
    this.showMobileChatList.set(true);

    // *** XÓA roomId KHỎI URL KHI QUAY LẠI LIST ***
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { roomId: null },
      queryParamsHandling: 'merge'
    });
  }
}
// Cần thêm hàm setCurrentChatRoom(roomId: number | null) vào ChatService
// để ChatService biết phòng nào đang mở và xử lý unread count/thông báo chính xác hơn.
