import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  computed, effect, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, OnInit
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ChatService } from '../../../service/ChatService';
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { ChatMessageResponse } from '../../../dto/response/ChatMessageResponse';
import { ChatMessageRequest } from '../../../dto/request/ChatMessageRequest';
import { LoadingSpinnerComponent } from '../../../../../shared/components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../../../../core/services/auth.service'; // Import AuthService
import { Page } from '../../../../../core/models/page.model'; // Import Page
import { Observable, Subject } from 'rxjs';
import { takeUntil, finalize, map } from 'rxjs/operators';
import {MessageType} from '../../../domain/message-type.enum';
import {AlertComponent} from '../../../../../shared/components/alert/alert.component';
import {PagedApiResponse} from '../../../../../core/models/api-response.model';
import {UserInfoSimpleResponse} from '../../../../user-profile/dto/response/UserInfoSimpleResponse';
import {TimeAgoPipe} from '../../../../../shared/pipes/time-ago.pipe';
import {ActivatedRoute, RouterLink} from '@angular/router';
import {routes} from '../../../../../app.routes';
import {SafeHtmlPipe} from '../../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-message-area',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, DatePipe, AlertComponent, TimeAgoPipe, RouterLink, SafeHtmlPipe],
  templateUrl: './message-area.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush // Sử dụng OnPush
})
export class MessageAreaComponent implements OnChanges, OnDestroy, OnInit   {
  @Input({ required: true }) selectedRoom!: ChatRoomResponse | null;
  @Output() backToList = new EventEmitter<void>(); // Event để quay lại list trên mobile

  @ViewChild('messageContainer') private messageContainer!: ElementRef; // Để scroll xuống cuối

  public  chatService = inject(ChatService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);

  // Biến để lưu trữ thông tin context từ URL, chỉ dùng cho tin nhắn đầu tiên
  private initialContextProductId: number | null = null;
  private initialContextProductName: string | null = null;
  private initialContextProductSlug: string | null = null;
  private contextHasBeenSentForThisRoom = false; // Cờ để đảm bảo context chỉ được gửi một lần cho mỗi lần mở phòng với context


  messages = signal<ChatMessageResponse[]>([]);
  isLoading = this.chatService.isLoadingMessages;
  isSending = this.chatService.isSendingMessage; // Lấy signal sending từ service
  errorMessage = signal<string | null>(null);
  currentUserId = computed(() => this.authService.currentUser()?.id); // Lấy ID user hiện tại

  // Phân trang
  currentPage = 0;
  pageSize = 30; // Số lượng tin nhắn load mỗi lần
  totalPages = 0;
  isLoadingMore = signal(false);
  hasMoreMessages = signal(true); // Còn tin nhắn cũ để load không
  //messages$ = this.chatService.currentMessages$;

  messageForm = this.fb.group({
    content: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  // Signal để lưu thông tin người đang chat cùng
  currentChatPartner = signal<UserInfoSimpleResponse | null>(null);

  //private shouldScrollToBottom = false; // Cờ để chỉ scroll khi có tin nhắn mới


  ngOnInit(): void { // Thêm ngOnInit
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const roomIdFromQuery = params.get('roomId');
      // Chỉ lấy context nếu roomId từ query khớp với phòng đang mở (hoặc khi phòng mới được mở)
      if (roomIdFromQuery && this.selectedRoom && this.selectedRoom.id === +roomIdFromQuery) {
        this.initialContextProductId = params.get('contextProductId') ? +params.get('contextProductId')! : null;
        this.initialContextProductName = params.get('contextProductName');
        this.initialContextProductSlug = params.get('contextProductSlug');
        this.contextHasBeenSentForThisRoom = false; // Reset cờ khi phòng (có thể với context mới) được chọn
        console.log('MessageArea received context:', this.initialContextProductId, this.initialContextProductName);
      } else if (!roomIdFromQuery) { // Nếu không có roomId trong query, reset context
        this.clearInitialContext();
      }
    });
  }

  // *** Thêm constructor hoặc ngOnInit để subscribe ***
  constructor() {
    // Lắng nghe tin nhắn từ service
    this.chatService.currentMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(newMessages => {
        console.log("[MessageAreaComponent] Received update from currentMessages$:", newMessages);
        const currentMsgArray = this.messages();
        // Chỉ cập nhật nếu thực sự có thay đổi để tránh trigger effect không cần thiết
        if (newMessages.length !== currentMsgArray.length || (newMessages.length > 0 && newMessages[newMessages.length - 1].id !== currentMsgArray[currentMsgArray.length - 1]?.id)) {
          this.messages.set(newMessages);
          // Không cần scroll ở đây, effect sẽ xử lý
        }
        this.cdr.markForCheck(); // Cần thiết khi dùng OnPush và nhận dữ liệu từ Observable
      });

    // Effect để scroll khi tin nhắn thay đổi
    effect(() => {
      const currentMessages = this.messages();
      if (currentMessages.length > 0 && this.messageContainer?.nativeElement) {
        // Chỉ scroll xuống nếu user đang ở gần cuối hoặc là tin nhắn mới của chính mình
        const element = this.messageContainer.nativeElement;
        const threshold = 100; // Ngưỡng pixel để coi là đang ở cuối
        const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < threshold;
        const lastMessageIsMine = currentMessages[currentMessages.length - 1]?.sender?.id === this.currentUserId();

        if (isNearBottom || lastMessageIsMine) {
          setTimeout(() => this.scrollToBottom('smooth'), 50); // Scroll mượt hơn, delay nhỏ
        }
      }
    });

    // Effect để cập nhật trạng thái online của người đang chat
    effect(() => {
      const partnerId = this.currentChatPartner()?.id;
      const onlineStatus = this.chatService.isUserOnline(partnerId); // Lắng nghe signal onlineUsers gián tiếp
      // Chỉ cần log hoặc làm gì đó nếu cần, template sẽ tự cập nhật
      console.log(`Online status changed for partner ${partnerId}: ${onlineStatus}`);
      this.cdr.markForCheck(); // Trigger kiểm tra lại component khi trạng thái online thay đổi
    });
  }

// Override ngOnChanges để reset context khi phòng thay đổi
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedRoom']) {
      const newRoom = changes['selectedRoom'].currentValue as ChatRoomResponse | null;
      this.currentChatPartner.set(newRoom?.otherUser || null); // Cập nhật signal partner
      if (newRoom) {
        this.resetChat();
        this.loadInitialMessages();
        this.chatService.setCurrentChatRoom(newRoom.id);
        // Kiểm tra lại queryParams khi phòng thay đổi
        const queryProductId = this.route.snapshot.queryParamMap.get('contextProductId');
        if (queryProductId && newRoom.id === +this.route.snapshot.queryParamMap.get('roomId')!) {
          this.initialContextProductId = +queryProductId;
          this.initialContextProductName = this.route.snapshot.queryParamMap.get('contextProductName');
          this.initialContextProductSlug = this.route.snapshot.queryParamMap.get('contextProductSlug');
          this.contextHasBeenSentForThisRoom = false;
          console.log('MessageArea context re-evaluated on room change:', this.initialContextProductId);
        } else {
          this.clearInitialContext();
        }

      } else {
        this.resetChat();
        this.chatService.setCurrentChatRoom(null);
        this.clearInitialContext();
      }
      this.cdr.markForCheck();
    }
  }

  private clearInitialContext(): void {
    this.initialContextProductId = null;
    this.initialContextProductName = null;
    this.initialContextProductSlug = null;
    this.contextHasBeenSentForThisRoom = true; // Coi như đã "xử lý" context rỗng
  }



  // ****** SỬA HÀM NÀY ******
  // ngAfterViewChecked(): void {
  //   if (this.shouldScrollToBottom) {
  //     // Đặt việc scroll vào setTimeout để nó chạy sau khi DOM đã cập nhật xong
  //     setTimeout(() => this.scrollToBottom(), 0);
  //     // Reset cờ ngay lập tức để tránh gọi scroll nhiều lần không cần thiết
  //     this.shouldScrollToBottom = false;
  //     console.log("Reset shouldScrollToBottom = false");
  //   }
  // }
  // *************************
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chatService.setCurrentChatRoom(null); // Thông báo không còn phòng nào mở
  }


  resetChat(): void {
    this.messages.set([]); // Reset signal messages
    this.currentPage = 0;
    this.totalPages = 0;
    this.hasMoreMessages.set(true);
    this.errorMessage.set(null);
    this.messageForm.reset();
    this.chatService.clearCurrentMessages();
  }

  loadInitialMessages(): void {
    if (!this.selectedRoom) return;
    this.currentPage = 0; // Bắt đầu từ trang đầu tiên (mới nhất)
    this.hasMoreMessages.set(true); // Giả định còn tin nhắn cũ
    this.loadMessages(true); // Load và scroll xuống dưới
  }

  loadPreviousMessages(): void {
    if (!this.selectedRoom || this.isLoadingMore() || !this.hasMoreMessages()) return;

    this.isLoadingMore.set(true);
    this.currentPage++; // Tăng trang để load tin nhắn cũ hơn
    this.loadMessages(false); // Load nhưng không scroll xuống dưới
  }


  private loadMessages(isInitialLoad: boolean): void {
    if (!this.selectedRoom) return;
    this.errorMessage.set(null);

    const scrollState = isInitialLoad ? null : { // Lưu vị trí scroll trước khi load thêm
      scrollHeight: this.messageContainer?.nativeElement.scrollHeight,
      scrollTop: this.messageContainer?.nativeElement.scrollTop
    };


    this.chatService.getChatMessages(this.selectedRoom.id, this.currentPage, this.pageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => {
          this.isLoadingMore.set(false);
          if (isInitialLoad) this.isLoading.set(false); // Chỉ tắt isLoading chính khi load lần đầu
        })
      )
      .subscribe({
        next: (res: PagedApiResponse<ChatMessageResponse>) => {
          if (res.success && res.data) {
            this.totalPages = res.data.totalPages;
            this.hasMoreMessages.set(!res.data.last);
            const newMessagesFromApi = res.data.content.reverse(); // API trả về mới nhất trước, cần đảo lại
            if (!isInitialLoad) {
              this.messages.update(current => {
                const combined = [...newMessagesFromApi, ...current];
                // **SẮP XẾP LẠI**
                combined.sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
                return combined;
              });
              // Khôi phục vị trí scroll sau khi DOM cập nhật
              setTimeout(() => {
                if (this.messageContainer?.nativeElement && scrollState) {
                  this.messageContainer.nativeElement.scrollTop =
                    this.messageContainer.nativeElement.scrollHeight - scrollState.scrollHeight + scrollState.scrollTop;
                }
              }, 0);
            } else {
              // Tin nhắn ban đầu đã được cập nhật qua currentMessages$
              // this.messages.set(newMessages); // Không cần set lại ở đây
              // Scroll xuống cuối sẽ được xử lý bởi effect
            }
          } else {
            this.errorMessage.set(res.message || "Lỗi tải tin nhắn.");
            this.hasMoreMessages.set(false);
          }
          this.cdr.markForCheck(); // Cần thiết khi dùng OnPush
        },
        error: (err) => {
          this.errorMessage.set(err.message || "Lỗi tải tin nhắn.");
          this.hasMoreMessages.set(false);
          this.cdr.markForCheck();
        }
      });
  }



  sendMessage(): void {
    // ... (logic gửi tin nhắn như cũ, bao gồm tạo tempMessage và gọi service) ...
    if (this.messageForm.invalid || !this.selectedRoom || !this.selectedRoom.otherUser) {
      return;
    }

    const contentToSend = this.messageForm.value.content || '';
    const recipientId = this.selectedRoom.otherUser.id;
    const currentRoomId = this.selectedRoom.id;
    const currentUser = this.authService.currentUser();

    if (!currentUser) return;

    const tempId = Date.now();
    const tempMessage: ChatMessageResponse = {
      id: tempId,
      roomId: currentRoomId,
      sender: {
        id: currentUser.id,
        fullName: currentUser.fullName,
        avatarUrl: currentUser.avatarUrl,
        phoneNumber: currentUser.phoneNumber,
        Online: true // Giả định mình đang online
      },
      recipient: this.selectedRoom.otherUser,
      content: contentToSend,
      messageType: MessageType.TEXT,
      sentAt: new Date().toISOString(),
      isRead: false,
      readAt: null,
    };

    // Thêm ngay vào signal để cập nhật UI
    this.messages.update(msgs => [...msgs, tempMessage]);
    // Effect sẽ tự scroll

    this.messageForm.reset();

    const request: ChatMessageRequest = {
      recipientId: recipientId,
      content: contentToSend,
      messageType: MessageType.TEXT,
      // **Đính kèm context nếu có và chưa được gửi cho phòng này**
      contextProductId: !this.contextHasBeenSentForThisRoom ? this.initialContextProductId : null,
      contextProductName: !this.contextHasBeenSentForThisRoom ? this.initialContextProductName : null,
      contextProductSlug: !this.contextHasBeenSentForThisRoom ? this.initialContextProductSlug : null
    };
    this.chatService.sendMessageViaWebSocket(request);
    this.messageForm.reset(); // Reset form sau khi gửi

    // Đánh dấu context đã được gửi cho lần này
    if (!this.contextHasBeenSentForThisRoom && this.initialContextProductId) {
      this.contextHasBeenSentForThisRoom = true;
      // Không cần xóa initialContext... ngay, nó sẽ được cập nhật khi route thay đổi
    }

  }
  // Hàm scroll xuống cuối
  scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    try {
      if (this.messageContainer?.nativeElement) {
        const element = this.messageContainer.nativeElement;
        element.scrollTo({ top: element.scrollHeight, behavior: behavior });
        // console.log(`Scrolled to bottom (${behavior}). ScrollTop: ${element.scrollTop}, ScrollHeight: ${element.scrollHeight}`);
      }
    } catch (err) {
      console.error("Could not scroll to bottom:", err);
    }
  }

  trackMessageById(index: number, message: ChatMessageResponse): number | string {
    // Dùng ID thật nếu có, hoặc ID tạm thời + sentAt để đảm bảo unique key
    return message.id > 0 ? message.id : `${message.id}-${message.sentAt}`;
  }
  shouldShowAvatar(currentIndex: number): boolean {
    if (currentIndex === 0) return true; // Luôn hiện avatar cho tin nhắn đầu tiên của người khác
    const currentMessage = this.messages()[currentIndex];
    const previousMessage = this.messages()[currentIndex - 1];
    // Hiện avatar nếu người gửi khác với tin nhắn trước, hoặc là tin nhắn đầu tiên của người đó trong một chuỗi
    return currentMessage.sender?.id !== previousMessage?.sender?.id;
  }
  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto'; // Reset chiều cao
    textarea.style.height = textarea.scrollHeight + 'px'; // Đặt chiều cao mới
  }
  sendMessageOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) { // Gửi khi nhấn Enter (không phải Shift+Enter)
      event.preventDefault(); // Ngăn xuống dòng mặc định
      this.sendMessage();
    }
  }
  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    // Nếu cuộn lên gần đầu và còn tin nhắn cũ, thì load thêm
    if (element.scrollTop < 50 && this.hasMoreMessages() && !this.isLoadingMore() && !this.isLoading()) {
      this.loadPreviousMessages();
    }
  }
}
