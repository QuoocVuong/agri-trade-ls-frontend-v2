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
            // Cập nhật lại signal với đầy đủ thông tin phòng
            this.selectedRoom.set(foundRoom);
            this.showMobileChatList.set(false); // Ẩn list nếu đã khôi phục phòng
            this.chatService.setCurrentChatRoom(foundRoom.id); // Báo cho service
          } else {
            // Nếu ID đã lưu không còn tồn tại trong danh sách mới -> reset
            this.clearSelectedRoom();
          }
        } else if (this.selectedRoom()?.id && (!rooms || rooms.length === 0)) {
          // Nếu có ID lưu nhưng danh sách phòng rỗng -> reset
          this.clearSelectedRoom();
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
    console.log('Room selected:', room);
    this.selectedRoom.set(room);
    this.showMobileChatList.set(false);
    this.chatService.setCurrentChatRoom(room.id);
    // Lưu ID vào sessionStorage
    sessionStorage.setItem(SELECTED_ROOM_ID_KEY, room.id.toString());
    // Cập nhật URL (tùy chọn)
    // this.router.navigate([], { relativeTo: this.route, queryParams: { roomId: room.id }, queryParamsHandling: 'merge' });

    // Đánh dấu đã đọc
    if (room.myUnreadCount && room.myUnreadCount > 0) {
      this.chatService.markMessagesAsRead(room.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({ error: (err) => console.error("Error marking room as read", err) });
    }
  }


  // Hàm để quay lại danh sách chat trên mobile
  backToChatList(): void {
    this.clearSelectedRoom();
  }

  private restoreSelectedRoom(): void {
    // Ưu tiên query param trước
    const queryRoomId = this.route.snapshot.queryParamMap.get('roomId');
    const storageRoomId = sessionStorage.getItem(SELECTED_ROOM_ID_KEY);
    const roomIdToRestore = queryRoomId ? +queryRoomId : (storageRoomId ? +storageRoomId : null);


    if (roomIdToRestore !== null && !isNaN(roomIdToRestore)) {
      console.log("Restoring selected room ID:", roomIdToRestore);
      // Tạm thời chỉ lưu ID, thông tin đầy đủ sẽ được cập nhật khi chatRooms$ phát ra
      this.selectedRoom.set({ id: roomIdToRestore } as ChatRoomResponse); // Ép kiểu tạm thời
      this.showMobileChatList.set(false); // Giả định ẩn list
      this.chatService.setCurrentChatRoom(roomIdToRestore);
    } else {
      this.selectedRoom.set(null);
      this.showMobileChatList.set(true);
      this.chatService.setCurrentChatRoom(null);
    }
  }

  private clearSelectedRoom(): void {
    this.selectedRoom.set(null);
    this.showMobileChatList.set(true);
    this.chatService.setCurrentChatRoom(null);
    sessionStorage.removeItem(SELECTED_ROOM_ID_KEY);
    // Xóa query param khỏi URL (tùy chọn)
    // this.router.navigate([], { relativeTo: this.route, queryParams: { roomId: null }, queryParamsHandling: 'merge' });
  }
}
// Cần thêm hàm setCurrentChatRoom(roomId: number | null) vào ChatService
// để ChatService biết phòng nào đang mở và xử lý unread count/thông báo chính xác hơn.
