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
  computed
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

@Component({
  selector: 'app-message-area',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, DatePipe, AlertComponent],
  templateUrl: './message-area.component.html',
})
export class MessageAreaComponent implements OnChanges, AfterViewChecked {
  @Input({ required: true }) selectedRoom!: ChatRoomResponse | null;
  @Output() backToList = new EventEmitter<void>(); // Event để quay lại list trên mobile

  @ViewChild('messageContainer') private messageContainer!: ElementRef; // Để scroll xuống cuối

  private chatService = inject(ChatService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

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

  private shouldScrollToBottom = false; // Cờ để chỉ scroll khi có tin nhắn mới

  // *** Thêm constructor hoặc ngOnInit để subscribe ***
  constructor() {
    // Lắng nghe cập nhật từ currentMessages$ của service
    this.chatService.currentMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(newMessages => {
        console.log("MessageArea received messages from service:", newMessages); // Log để debug
        // Chỉ cập nhật nếu danh sách mới khác danh sách cũ (tránh vòng lặp vô hạn nếu có)
        // So sánh đơn giản bằng độ dài và ID cuối cùng (có thể cần cách so sánh sâu hơn)
        const currentMsgArray = this.messages();
        if (newMessages.length !== currentMsgArray.length ||
          (newMessages.length > 0 && newMessages[newMessages.length - 1].id !== currentMsgArray[currentMsgArray.length - 1]?.id))
        {
          this.messages.set(newMessages); // Cập nhật signal của component
          // Đặt cờ scroll khi có tin nhắn mới từ service (bao gồm cả tin nhắn mình gửi và người khác gửi)
          this.shouldScrollToBottom = true;
        }
      });
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedRoom']) { // Chỉ chạy khi selectedRoom thay đổi thực sự
      if (this.selectedRoom) {
        this.resetChat();
        this.loadInitialMessages();
        // *** Thông báo cho service biết phòng nào đang mở ***
        this.chatService.setCurrentChatRoom(this.selectedRoom.id);
      } else {
        this.resetChat();
        // *** Thông báo cho service không có phòng nào mở ***
        this.chatService.setCurrentChatRoom(null);
      }
    }
  }


  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false; // Reset cờ
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    // Reset phòng đang mở khi component bị hủy
    this.chatService.setCurrentChatRoom(null);
  }


  resetChat(): void {
    // Không reset this.messages() ở đây nữa vì nó sẽ được cập nhật từ service
    // this.messages.set([]);
    this.currentPage = 0;
    this.totalPages = 0;
    this.hasMoreMessages.set(true);
    this.errorMessage.set(null);
    this.messageForm.reset();
    // Xóa tin nhắn cũ trong service khi đổi phòng
    this.chatService.clearCurrentMessages(); // <-- Thêm hàm này vào ChatService
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

    this.chatService.getChatMessages(this.selectedRoom.id, this.currentPage, this.pageSize)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingMore.set(false))
      )
      .subscribe({
        // Chỉ cần xử lý thông tin phân trang và lỗi
        next: (res: PagedApiResponse<ChatMessageResponse>) => {
          if (res.success && res.data) {
            this.totalPages = res.data.totalPages;
            this.hasMoreMessages.set(!res.data.last);
            if (isInitialLoad) {
              this.shouldScrollToBottom = true;
            }
          } else {
            this.errorMessage.set(res.message || "Lỗi tải tin nhắn.");
            this.hasMoreMessages.set(false);
          }
        },
        error: (err) => {
          this.errorMessage.set(err.message || "Lỗi tải tin nhắn.");
          this.hasMoreMessages.set(false);
        }
      });
  }



  sendMessage(): void {
    if (this.messageForm.invalid || !this.selectedRoom || !this.selectedRoom.otherUser) {
      return;
    }

    const request: ChatMessageRequest = {
      recipientId: this.selectedRoom.otherUser.id, // Gửi cho người kia trong phòng
      content: this.messageForm.value.content || '',
      messageType: MessageType.TEXT // Mặc định là text
    };

    // Gọi service để gửi qua WebSocket
    this.chatService.sendMessageViaWebSocket(request);
    this.messageForm.reset(); // Xóa ô input sau khi gửi
    //this.shouldScrollToBottom = true; // Scroll xuống khi gửi tin nhắn mới
  }

  // Hàm scroll xuống cuối
  private scrollToBottom(): void {
    try {
      if (this.messageContainer?.nativeElement) {
        this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
        // Dùng setTimeout nhỏ để đảm bảo DOM đã update hoàn toàn
        // setTimeout(() => {
        //     if (this.messageContainer?.nativeElement) {
        //         this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
        //     }
        // }, 0);
      }
    } catch (err) {
      console.error("Could not scroll to bottom:", err);
    }
  }

  trackMessageById(index: number, message: ChatMessageResponse): number {
    return message.id;
  }
}
