import {Injectable, inject, signal, effect} from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {Observable, BehaviorSubject, tap, finalize, shareReplay, firstValueFrom, map, of, Subject} from 'rxjs'; // Import thêm
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { ChatRoomResponse } from '../dto/response/ChatRoomResponse';
import { ChatMessageResponse } from '../dto/response/ChatMessageResponse';
import { ChatMessageRequest } from '../dto/request/ChatMessageRequest'; // Import request DTO
import { AuthService } from '../../../core/services/auth.service';
// Import thư viện WebSocket STOMP
import { RxStomp, RxStompConfig } from '@stomp/rx-stomp'; // Dùng RxStomp cho tích hợp RxJS
import { IMessage } from '@stomp/stompjs';
import {log} from '@angular-devkit/build-angular/src/builders/ssr-dev-server';
import {takeUntil} from 'rxjs/operators';
import {ToastrService} from 'ngx-toastr'; // Import IMessage

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = `${environment.apiUrl}/chat`;
  private wsUrl = environment.wsUrl; // URL WebSocket từ environment

  // State cho danh sách phòng chat
  private chatRoomsSubject = new BehaviorSubject<ChatRoomResponse[]>([]);
  public chatRooms$ = this.chatRoomsSubject.asObservable();

  // State cho tin nhắn của phòng đang mở (ví dụ)
  private currentMessagesSubject = new BehaviorSubject<ChatMessageResponse[]>([]);
  public currentMessages$ = this.currentMessagesSubject.asObservable();
  private currentRoomId: number | null = null;
  private currentRoomIdSignal = signal<number | null>(null); // Dùng signal để lưu room ID đang mở

  // Signal loading
  public isLoadingRooms = signal(false);
  public isLoadingMessages = signal(false);
  public isSendingMessage = signal(false);

  // WebSocket Client với RxStomp
  private rxStomp: RxStomp;

  constructor(
    private toastr: ToastrService,) {

    this.rxStomp = new RxStomp();
    this.configureWebSocket();

    // Lắng nghe thay đổi trạng thái đăng nhập để connect/disconnect WS
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.connectWebSocket();
        this.loadMyChatRooms().subscribe(); // Tải danh sách phòng khi login
      } else {
        this.disconnectWebSocket();
        this.chatRoomsSubject.next([]); // Xóa danh sách phòng khi logout
        this.currentMessagesSubject.next([]);
        this.currentRoomId = null;
      }

    }, { allowSignalWrites: true });


  }

  // --- WebSocket Logic ---

  private configureWebSocket(): void {
    const stompConfig: RxStompConfig = {
      brokerURL: this.wsUrl, // Ví dụ: 'ws://localhost:8080/ws'

      // Headers để gửi khi connect (quan trọng cho xác thực JWT)
      connectHeaders: {
        // Backend sẽ cần interceptor để đọc header này và xác thực
        Authorization: `Bearer ${this.authService.getToken() || ''}`
      },

      // Heartbeat (giữ kết nối)
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,

      // Tự động reconnect
      reconnectDelay: 5000,

      // Debug (tùy chọn)
      debug: (str) => {
        console.log('STOMP Debug: ' + str);
      },
    };
    this.rxStomp.configure(stompConfig);
  }

  private connectWebSocket(): void {
    if (this.rxStomp.connected()) {
      console.log("WebSocket already connected.");
      return;
    }
    // Cập nhật lại connectHeaders với token mới nhất trước khi connect
    this.rxStomp.configure({ connectHeaders: { Authorization: `Bearer ${this.authService.getToken() || ''}` } });
    this.rxStomp.activate(); // Bắt đầu kết nối

    // Lắng nghe các message từ server gửi về private queue của user
    this.rxStomp.watch(`/user/queue/messages`)
      .pipe(takeUntil(this.destroy$)) // Cần destroy$ để unsubscribe
      .subscribe((message: IMessage) => {
        try {
          const chatMessage: ChatMessageResponse = JSON.parse(message.body);
          console.log("Received new message via WS:", chatMessage);
          // TODO: Cập nhật UI (thêm vào danh sách tin nhắn nếu phòng đang mở, cập nhật unread count...)
          this.handleIncomingMessage(chatMessage);
        } catch (e) {
          console.error("Error parsing incoming WS message:", e);
        }
      });

    // Lắng nghe thông báo đã đọc
    this.rxStomp.watch(`/user/queue/read`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: IMessage) => {
        try {
          const readEvent = JSON.parse(message.body); // Giả sử là MessageReadEvent
          console.log("Received read notification via WS:", readEvent);
          // TODO: Cập nhật trạng thái 'đã xem' trên UI của tin nhắn tương ứng
        } catch (e) {
          console.error("Error parsing read notification:", e);
        }
      });

    // Lắng nghe lỗi từ server (nếu có)
    this.rxStomp.watch(`/user/queue/errors`)
      .pipe(takeUntil(this.destroy$))
      .subscribe((message: IMessage) => {
        try {
          const errorEvent = JSON.parse(message.body); // Giả sử là WebSocketErrorEvent
          console.log("Received error via WS:", errorEvent);
          this.toastr.error(`Lỗi chat: ${errorEvent.message || 'Lỗi không xác định'}`);
        } catch (e) {
          console.error("Error parsing error event:", e);
        }
      });
  }

  private disconnectWebSocket(): void {
    if (this.rxStomp.active) {
      this.rxStomp.deactivate();
      console.log("WebSocket disconnected.");
    }
  }

  // Xử lý tin nhắn đến
  private handleIncomingMessage(newMessage: ChatMessageResponse): void {
    // Cập nhật danh sách phòng chat (đưa phòng có tin nhắn mới lên đầu, tăng unread count)
    const currentRooms = this.chatRoomsSubject.value || [];
    let roomUpdated = false;

    const currentOpenRoomId = this.currentRoomIdSignal(); // Lấy giá trị từ signal
    const myUserId = this.authService.getCurrentUser()?.id;

    const updatedRooms = currentRooms.map(room => {
      if (room.id === newMessage.roomId) {
        roomUpdated = true;
        // // Chỉ tăng unread nếu user hiện tại là người nhận và không đang mở phòng đó
        // const isRecipient = room.user1?.id === newMessage.recipient?.id || room.user2?.id === newMessage.recipient?.id;
        // const isCurrentUserRecipient = this.authService.getCurrentUser()?.id === newMessage.recipient?.id;
        //
        // let newUnreadCount = room.myUnreadCount; // Giữ nguyên nếu mình là người gửi
        // if (isCurrentUserRecipient && room.id !== this.currentRoomId) { // Tăng nếu mình là người nhận và KHÔNG đang mở phòng
        //   newUnreadCount = (room.myUnreadCount || 0) + 1;
        // }
        const isCurrentUserRecipient = myUserId === newMessage.recipient?.id;
        let newUnreadCount = room.myUnreadCount ?? 0; // Lấy giá trị hiện tại

        // Chỉ tăng unread nếu mình là người nhận VÀ phòng này KHÔNG đang mở
        if (isCurrentUserRecipient && room.id !== currentOpenRoomId) {
          newUnreadCount++;
        }

        // Xác định otherUser một lần ở đây nếu chưa có
        if (!room.otherUser && myUserId) {
          room.otherUser = room.user1?.id === myUserId ? room.user2 : room.user1;
        }
        // Cập nhật myUnreadCount để component dùng
        if(room.user1?.id === myUserId) room.user1UnreadCount = newUnreadCount;
        else if (room.user2?.id === myUserId) room.user2UnreadCount = newUnreadCount;
        room.myUnreadCount = newUnreadCount;


        return { ...room, lastMessage: newMessage, lastMessageTime: newMessage.sentAt, myUnreadCount: newUnreadCount };
      }
      return room;
    });

    // Nếu là phòng chat mới hoàn toàn (chưa có trong list) -> load lại list? Hoặc thêm vào?
    if (!roomUpdated) {
      // Tạm thời load lại toàn bộ list để đơn giản
      this.loadMyChatRooms().subscribe();
    } else {
      // Sắp xếp lại để đưa phòng mới nhất lên đầu
      updatedRooms.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
      this.chatRoomsSubject.next(updatedRooms);
    }


    // Nếu phòng chat đang mở, thêm tin nhắn vào danh sách hiện tại
    if (newMessage.roomId === this.currentRoomId) {
      const currentMessages = this.currentMessagesSubject.value;
      this.currentMessagesSubject.next([...currentMessages, newMessage]);
      // Tự động đánh dấu đã đọc nếu đang mở phòng?
       this.markMessagesAsRead(newMessage.roomId).subscribe(); // Gọi API đánh dấu đã đọc
    }
  }


  // --- Phương thức mới ---
  /**
   * Đánh dấu phòng chat nào đang được người dùng mở và xem.
   * Giúp service biết để không tăng unread count cho phòng này khi có tin nhắn mới,
   * hoặc để tự động đánh dấu đã đọc khi mở phòng.
   * @param roomId ID của phòng đang mở, hoặc null nếu không có phòng nào đang mở.
   */
  public setCurrentChatRoom(roomId: number | null): void {
    this.currentRoomIdSignal.set(roomId);
    console.log(`Current chat room set to: ${roomId}`);
    // Có thể thêm logic tự động đánh dấu đã đọc ở đây nếu muốn
    // if (roomId !== null) {
    //     this.markMessagesAsRead(roomId).subscribe();
    // }
  }



  // --- API Calls ---

  loadMyChatRooms(): Observable<ApiResponse<ChatRoomResponse[]>> {
    this.isLoadingRooms.set(true);
    return this.http.get<ApiResponse<ChatRoomResponse[]>>(`${this.apiUrl}/rooms`).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.chatRoomsSubject.next(response.data);
        } else {
          this.chatRoomsSubject.next([]);
        }
      }),
      finalize(() => this.isLoadingRooms.set(false))
    );
  }

  getOrCreateChatRoom(recipientId: number): Observable<ApiResponse<ChatRoomResponse>> {
    // API này có thể không cần thiết nếu dùng WebSocket để bắt đầu chat
    // Hoặc dùng để lấy thông tin phòng trước khi mở
    return this.http.post<ApiResponse<ChatRoomResponse>>(`${this.apiUrl}/rooms/user/${recipientId}`, {});
  }

  // Gửi tin nhắn qua WebSocket (thay vì API)
  sendMessageViaWebSocket(request: ChatMessageRequest): void {
    if (!this.rxStomp.active) {
      console.log("WebSocket not active. Cannot send message.");
      this.toastr.error("Mất kết nối chat. Vui lòng thử lại.");
      // Có thể thử kết nối lại: this.connectWebSocket();
      return;
    }
    this.isSendingMessage.set(true); // Bật loading (tạm thời)
    try {
      // Gửi đến endpoint của server đã cấu hình trong WebSocketChatController
      this.rxStomp.publish({ destination: '/app/chat.sendMessage', body: JSON.stringify(request) });
      console.log("Published message via WS to /app/chat.sendMessage");
      // Loading sẽ tắt khi nhận được message trả về hoặc lỗi
    } catch (e) {
      console.log("Error publishing message via WS", e);
      this.toastr.error("Lỗi gửi tin nhắn.");
      this.isSendingMessage.set(false);
    } finally {
      // Cần cơ chế xử lý loading tốt hơn, ví dụ chờ xác nhận từ server
      setTimeout(() => this.isSendingMessage.set(false), 500); // Tạm thời tắt sau 0.5s
    }
  }


  // Lấy lịch sử tin nhắn (API)
  getChatMessages(roomId: number, page: number, size: number): Observable<PagedApiResponse<ChatMessageResponse>> {
    this.isLoadingMessages.set(true);
    this.currentRoomId = roomId; // Đánh dấu phòng đang mở
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'sentAt,desc'); // Lấy tin nhắn mới nhất trước

    return this.http.get<PagedApiResponse<ChatMessageResponse>>(`${this.apiUrl}/rooms/${roomId}/messages`, { params }).pipe(
      tap(response => {
        if (response.success && response.data) {
          // Cập nhật danh sách tin nhắn (có thể cần đảo ngược thứ tự nếu muốn hiển thị từ cũ đến mới)
          const messages = response.data.content.reverse();
          this.currentMessagesSubject.next(messages);
          // Sau khi load tin nhắn, đánh dấu đã đọc
          this.markMessagesAsRead(roomId).subscribe();
        } else {
          this.currentMessagesSubject.next([]);
        }
      }),
      finalize(() => this.isLoadingMessages.set(false))
    );
  }

  // Đánh dấu đã đọc (API)
  markMessagesAsRead(roomId: number): Observable<ApiResponse<void>> {
    // Kiểm tra xem có tin nhắn chưa đọc trong phòng này không trước khi gọi API
    const room = this.chatRoomsSubject.value?.find(r => r.id === roomId);
    const myId = this.authService.getCurrentUser()?.id;
    let myUnreadCount = 0;
    if(room && myId) {
      myUnreadCount = room.user1?.id === myId ? room.user1UnreadCount : room.user2UnreadCount;
    }

    if (myUnreadCount > 0) {
      console.log("Marking messages as read for room {}", roomId);
      return this.http.post<ApiResponse<void>>(`${this.apiUrl}/rooms/${roomId}/read`, {}).pipe(
        tap(() => {
          // Cập nhật lại trạng thái unread count trong BehaviorSubject
          const currentRooms = this.chatRoomsSubject.value || [];
          const updatedRooms = currentRooms.map(r => {
            if (r.id === roomId) {
              if (r.user1?.id === myId) r.user1UnreadCount = 0;
              else if (r.user2?.id === myId) r.user2UnreadCount = 0;
              r.myUnreadCount = 0; // Cập nhật cả myUnreadCount
            }
            return r;
          });
          this.chatRoomsSubject.next(updatedRooms);
        })
      );
    } else {
      // Không cần gọi API nếu không có tin nhắn chưa đọc
      return of({ success: true, message: 'No unread messages', status: 200, timestamp: new Date().toISOString() });
    }
  }

  // Lấy tổng số tin nhắn chưa đọc (API)
  getTotalUnreadMessages(): Observable<ApiResponse<number>> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/unread-count`);
  }

  // Cần thêm destroy$ để quản lý unsubscribe
  private destroy$ = new Subject<void>();
  ngOnDestroy(): void { // Implement OnDestroy trong component dùng service này
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectWebSocket(); // Ngắt kết nối WS khi service bị hủy (thường là khi logout)
  }
}
