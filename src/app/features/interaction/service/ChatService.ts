import {Injectable, inject, signal, effect, WritableSignal} from '@angular/core';
import {HttpClient, HttpErrorResponse, HttpParams} from '@angular/common/http';
import {
  Observable,
  BehaviorSubject,
  tap,
  finalize,
  shareReplay,
  firstValueFrom,
  map,
  of,
  Subject,
  throwError
} from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse, PagedApiResponse } from '../../../core/models/api-response.model';
import { ChatRoomResponse } from '../dto/response/ChatRoomResponse';
import { ChatMessageResponse } from '../dto/response/ChatMessageResponse';
import { ChatMessageRequest } from '../dto/request/ChatMessageRequest';
import { AuthService } from '../../../core/services/auth.service';

import { RxStomp, RxStompConfig } from '@stomp/rx-stomp';
import { IMessage } from '@stomp/stompjs';

import {catchError, takeUntil} from 'rxjs/operators';
import {ToastrService} from 'ngx-toastr';
import {WebSocketErrorEvent} from '../dto/event/WebSocketErrorEvent';
import {MessageReadEvent} from '../dto/event/MessageReadEvent';
import {PresenceEvent} from '../dto/event/PresenceEvent';

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



  private onlineUsersMap: WritableSignal<ReadonlyMap<number, boolean>> = signal(new Map());
  public onlineUsers = this.onlineUsersMap.asReadonly(); // Signal readonly cho component


  constructor(
    private toastr: ToastrService,) {

    this.rxStomp = new RxStomp();
    this.configureWebSocket();

    // Lắng nghe thay đổi trạng thái đăng nhập để connect/disconnect WS
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.connectWebSocketAndSubscribe();
        this.loadMyChatRooms().subscribe(); // Tải danh sách phòng khi login
      } else {
        this.disconnectWebSocket();
        this.chatRoomsSubject.next([]);
        this.currentMessagesSubject.next([]);
        this.currentRoomIdSignal.set(null);
        this.onlineUsersMap.set(new Map()); // Reset map online
        this.currentRoomId = null;
      }

    }, { allowSignalWrites: true });


  }


  private connectWebSocketAndSubscribe(): void {
    if (this.rxStomp.active) {

      return;
    }

    this.rxStomp.activate();

    // Subscribe vào các kênh cần thiết
    this.subscribeToPresence();
    this.subscribeToMessages();
    this.subscribeToReadReceipts();
    this.subscribeToErrors();
  }



  // --- WebSocket Logic ---

  private configureWebSocket(): void {
    const stompConfig: RxStompConfig = {
      brokerURL: this.wsUrl,

      // Headers để gửi khi connect (quan trọng cho xác thực JWT)
      connectHeaders: {
        // Backend sẽ cần interceptor để đọc header này và xác thực
        Authorization: `Bearer ${this.authService.getAccessToken() || ''}`
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



  private disconnectWebSocket(): void {
    if (this.rxStomp.active) {
      this.rxStomp.deactivate();
      console.log("WebSocket disconnected.");
    }
  }

  // Xử lý tin nhắn đến
  // Xử lý tin nhắn đến từ WebSocket
  private handleIncomingMessage(newMessage: ChatMessageResponse): void {
    const myUserId = this.authService.currentUser()?.id;
    const currentOpenRoomId = this.currentRoomIdSignal();

    this.updateChatRoomList(newMessage);

    if (newMessage.roomId === currentOpenRoomId) {
      const updatedMessages = [...this.currentMessagesSubject.getValue(), newMessage];
      this.currentMessagesSubject.next(updatedMessages);

      if (myUserId === newMessage.recipient?.id) {
        this.markMessagesAsRead(newMessage.roomId).subscribe();
      }
    } else {
      if (myUserId === newMessage.recipient?.id) {
        this.toastr.info(`Có tin nhắn mới từ ${newMessage.sender?.fullName || 'Ai đó'}`);
      }
    }
  }

  // Hàm helper để cập nhật danh sách phòng chat
  private updateChatRoomList(newMessage: ChatMessageResponse): void {
    const currentRooms = this.chatRoomsSubject.getValue();
    let roomFound = false;
    const myUserId = this.authService.currentUser()?.id;

    const updatedRooms = currentRooms.map(room => {
      if (room.id === newMessage.roomId) {
        roomFound = true;
        const isRecipient = myUserId === newMessage.recipient?.id;
        const isRoomOpen = this.currentRoomIdSignal() === room.id;

        // Chỉ tăng unread count nếu là người nhận và phòng không mở
        if (isRecipient && !isRoomOpen) {
          // Khởi tạo myUnreadCount nếu nó chưa tồn tại
          if (room.myUnreadCount === undefined || room.myUnreadCount === null) {
            room.myUnreadCount = 0;
          }

          // Bây giờ có thể tăng một cách an toàn
          room.myUnreadCount++;

          // Cập nhật cả các trường gốc nếu cần
          if (room.user1?.id === myUserId) {
            room.user1UnreadCount = (room.user1UnreadCount ?? 0) + 1;
          } else if (room.user2?.id === myUserId) {
            room.user2UnreadCount = (room.user2UnreadCount ?? 0) + 1;
          }
        }

        // Trả về object mới với các thông tin đã cập nhật
        return { ...room, lastMessage: newMessage, lastMessageTime: newMessage.sentAt };
      }
      return room;
    });

    if (!roomFound) {
      this.loadMyChatRooms().subscribe(); // Load lại nếu là phòng mới
    } else {
      // Sắp xếp lại để đưa phòng có tin nhắn mới lên đầu
      updatedRooms.sort((a, b) => new Date(b.lastMessageTime || 0).getTime() - new Date(a.lastMessageTime || 0).getTime());
      this.chatRoomsSubject.next(updatedRooms);
    }
  }




  public setCurrentChatRoom(roomId: number | null): void {
    this.currentRoomIdSignal.set(roomId);

  }



  private subscribeToPresence(): void {
    console.log("Attempting to subscribe to /topic/presence");
    this.rxStomp.watch('/topic/presence')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message: IMessage) => {
          try {
            const presenceUpdate: PresenceEvent = JSON.parse(message.body);
            console.log("Received presence update:", presenceUpdate);
            if (presenceUpdate && typeof presenceUpdate.userId === 'number' && typeof presenceUpdate.online === 'boolean') {
              this.onlineUsersMap.update(currentMap => {
                const newMap = new Map(currentMap);
                newMap.set(presenceUpdate.userId, presenceUpdate.online);
                console.log('Updated onlineUsersMap via WS:', newMap);
                return newMap;
              });
            } else {
              console.warn("Received invalid presence message:", message.body);
            }
          } catch (e) {
            console.error("Error parsing presence update:", e);
          }
        },
        error: (err) => console.error("Error in presence subscription:", err),
        complete: () => console.log("Presence subscription completed.") // Thường không xảy ra trừ khi disconnect
      });
  }


  // ******  HÀM KIỂM TRA ONLINE ******
// Trả về boolean trực tiếp từ signal để dùng trong template không cần async pipe
  isUserOnline(userId: number | null | undefined): boolean {
    if (userId == null) return false;
    const isOnline = this.onlineUsers().get(userId);
    return isOnline ?? false; // Trả về false nếu không tìm thấy trong map
  }


  // ******  ĐỊNH NGHĨA CÁC HÀM SUBSCRIBE ******
  private subscribeToMessages(): void {
    console.log("Attempting to subscribe to /user/queue/messages");
    this.rxStomp.watch(`/user/queue/messages`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message: IMessage) => { /* ... xử lý handleIncomingMessage ... */
          try {
            const chatMessage: ChatMessageResponse = JSON.parse(message.body);
            this.handleIncomingMessage(chatMessage);
          } catch (e) { console.error("Error parsing incoming WS message:", e); }
        },
        error: (err) => console.error("Error in messages subscription:", err)
      });
  }

  private subscribeToReadReceipts(): void {
    console.log("Attempting to subscribe to /user/queue/read");
    this.rxStomp.watch(`/user/queue/read`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next:(message: IMessage) => { /* ... xử lý handleReadReceipt ... */
          try {
            const readEvent: MessageReadEvent = JSON.parse(message.body);
            this.handleReadReceipt(readEvent);
          } catch (e) { console.error("Error parsing read notification:", e); }
        },
        error: (err) => console.error("Error in read receipts subscription:", err)
      });
  }

  private subscribeToErrors(): void {
    console.log("Attempting to subscribe to /user/queue/errors");
    this.rxStomp.watch(`/user/queue/errors`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (message: IMessage) => { /* ... xử lý lỗi từ WS ... */
          try {
            const errorEvent: WebSocketErrorEvent = JSON.parse(message.body);
            console.error("Received error via WS:", errorEvent);
            this.toastr.error(`Lỗi chat: ${errorEvent.message || 'Lỗi không xác định'}`);
          } catch (e) { console.error("Error parsing error event:", e); }
        },
        error: (err) => console.error("Error in errors subscription:", err)
      });
  }



  // ******  HÀM XỬ LÝ READ RECEIPT ******
  private handleReadReceipt(readEvent: MessageReadEvent): void {
    const currentMessages = this.currentMessagesSubject.value;
    // Chỉ cập nhật nếu phòng đang mở là phòng có tin nhắn được đọc
    if (readEvent.roomId === this.currentRoomIdSignal()) {
      let messagesUpdated = false;
      const updatedMessages = currentMessages.map(msg => {
        // Chỉ cập nhật tin nhắn của MÌNH đã gửi đi và chưa được đọc
        if (msg.sender?.id === this.authService.currentUser()?.id && !msg.isRead) {
          messagesUpdated = true;
          // Giả sử server chỉ báo là đã đọc, không gửi thời gian đọc cụ thể qua WS
          return { ...msg, isRead: true, readAt: new Date().toISOString() };
        }
        return msg;
      });

      if (messagesUpdated) {
        this.currentMessagesSubject.next(updatedMessages);
        console.log(`Updated read status for sent messages in room ${readEvent.roomId}`);
      }
    }
  }





  // --- API Calls ---

  loadMyChatRooms(): Observable<ApiResponse<ChatRoomResponse[]>> {
    this.isLoadingRooms.set(true);
    return this.http.get<ApiResponse<ChatRoomResponse[]>>(`${this.apiUrl}/rooms`).pipe(
      tap(response => {
        if (response.success && response.data) {
          this.chatRoomsSubject.next(response.data);
          // Cập nhật trạng thái online ban đầu từ API
          this.onlineUsersMap.update(currentMap => {
            const newMap = new Map(currentMap);
            response.data?.forEach(room => {
              // Sử dụng otherUser đã được tính toán sẵn (nếu có)
              const userToCheck = room.otherUser; // Giả định otherUser đã có isOnline
              if (userToCheck && typeof userToCheck.Online === 'boolean') {
                // Chỉ cập nhật nếu chưa có hoặc trạng thái khác
                if (!newMap.has(userToCheck.id) || newMap.get(userToCheck.id) !== userToCheck.Online) {
                  newMap.set(userToCheck.id, userToCheck.Online);
                }
              }

              if (room.user1 && typeof room.user1.Online === 'boolean' && (!newMap.has(room.user1.id) || newMap.get(room.user1.id) !== room.user1.Online)) {
                 newMap.set(room.user1.id, room.user1.Online);
              }
              if (room.user2 && typeof room.user2.Online === 'boolean' && (!newMap.has(room.user2.id) || newMap.get(room.user2.id) !== room.user2.Online)) {
                  newMap.set(room.user2.id, room.user2.Online);
              }
            });
            console.log('Initial/Updated online statuses from API:', newMap);
            return newMap;
          });
        } else {
          this.chatRoomsSubject.next([]);
        }
      }),
      finalize(() => this.isLoadingRooms.set(false)),
      catchError(err => {
        console.error("Error loading chat rooms", err);
        this.chatRoomsSubject.next([]); // Đặt về rỗng khi lỗi
        return of(err.error as ApiResponse<ChatRoomResponse[]>);
      })
    );
  }

  getOrCreateChatRoom(recipientId: number): Observable<ApiResponse<ChatRoomResponse>> {

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
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('sort', 'sentAt,desc');

    return this.http.get<PagedApiResponse<ChatMessageResponse>>(`${this.apiUrl}/rooms/${roomId}/messages`, { params }).pipe(
      tap(response => {
        if (response.success && response.data) {
          const messagesFromApi = response.data.content.reverse();

          if (page === 0) {
            this.currentMessagesSubject.next(messagesFromApi);
          } else {
            const currentMessages = this.currentMessagesSubject.getValue();
            this.currentMessagesSubject.next([...messagesFromApi, ...currentMessages]);
          }
        } else {
          if (page === 0) this.currentMessagesSubject.next([]);
        }
      }),
      finalize(() => this.isLoadingMessages.set(false))
    );
  }

  // Đánh dấu đã đọc (API)
  markMessagesAsRead(roomId: number): Observable<ApiResponse<void>> {
    // Kiểm tra xem có tin nhắn chưa đọc trong phòng này không trước khi gọi API
    const room = this.chatRoomsSubject.value?.find(r => r.id === roomId);
    const myId = this.authService.currentUser()?.id;
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


  public clearCurrentMessages(): void {
    this.currentMessagesSubject.next([]);
  }


  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);

    return throwError(() => error); // Ném lại lỗi để component xử lý
  }


}
