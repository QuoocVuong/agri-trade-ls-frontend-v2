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
  OnDestroy,
  computed,
  OnInit, ChangeDetectorRef
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ChatService } from '../../../service/ChatService';
import { ChatRoomResponse } from '../../../dto/response/ChatRoomResponse';
import { ChatMessageResponse } from '../../../dto/response/ChatMessageResponse';
import { ChatMessageRequest } from '../../../dto/request/ChatMessageRequest';
import { LoadingSpinnerComponent } from '../../../../../shared/components/loading-spinner/loading-spinner.component';
import { AuthService } from '../../../../../core/services/auth.service';
import { Subject } from 'rxjs';
import { takeUntil, finalize } from 'rxjs/operators';
import { MessageType } from '../../../domain/message-type.enum';
import { AlertComponent } from '../../../../../shared/components/alert/alert.component';
import { UserInfoSimpleResponse } from '../../../../user-profile/dto/response/UserInfoSimpleResponse';
import { TimeAgoPipe } from '../../../../../shared/pipes/time-ago.pipe';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SafeHtmlPipe } from '../../../../../shared/pipes/safe-html.pipe';

@Component({
  selector: 'app-message-area',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LoadingSpinnerComponent, DatePipe, AlertComponent, TimeAgoPipe, RouterLink, SafeHtmlPipe],
  templateUrl: './message-area.component.html',

})
export class MessageAreaComponent implements OnChanges, OnDestroy, OnInit {
  @Input({ required: true }) selectedRoom!: ChatRoomResponse | null;
  @Output() backToList = new EventEmitter<void>();

  @ViewChild('messageContainer') private messageContainer!: ElementRef;

  public chatService = inject(ChatService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  // Biến để lưu trữ thông tin context từ URL
  private initialContextProductId: number | null = null;
  private initialContextProductName: string | null = null;
  private initialContextProductSlug: string | null = null;
  private contextHasBeenSentForThisRoom = false;

  private cdr = inject(ChangeDetectorRef);

  // Sử dụng trực tiếp Observable từ service
  messages$ = this.chatService.currentMessages$;

  isLoading = this.chatService.isLoadingMessages;
  isSending = this.chatService.isSendingMessage;
  errorMessage = signal<string | null>(null);
  currentUserId = computed(() => this.authService.currentUser()?.id);
  currentChatPartner = signal<UserInfoSimpleResponse | null>(null);

  // Phân trang
  currentPage = 0;
  pageSize = 30;
  isLoadingMore = signal(false);
  hasMoreMessages = signal(true);

  messageForm = this.fb.group({
    content: ['', [Validators.required, Validators.maxLength(2000)]]
  });

  constructor() {
    // Lắng nghe tin nhắn từ service và trigger change detection
    this.chatService.currentMessages$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        // Mỗi khi có một mảng tin nhắn mới được phát ra từ service,
        // chúng ta báo cho Angular rằng component này cần được kiểm tra lại.
        this.cdr.markForCheck();

        // Đồng thời, scroll xuống cuối
        setTimeout(() => this.scrollToBottom('smooth'), 100);
      });
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const roomIdFromQuery = params.get('roomId');
      if (roomIdFromQuery && this.selectedRoom && this.selectedRoom.id === +roomIdFromQuery) {
        this.initialContextProductId = params.get('contextProductId') ? +params.get('contextProductId')! : null;
        this.initialContextProductName = params.get('contextProductName');
        this.initialContextProductSlug = params.get('contextProductSlug');
        this.contextHasBeenSentForThisRoom = false;
      } else if (!roomIdFromQuery) {
        this.clearInitialContext();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedRoom']) {
      const newRoom = changes['selectedRoom'].currentValue as ChatRoomResponse | null;
      this.currentChatPartner.set(newRoom?.otherUser || null);

      if (newRoom) {
        this.chatService.setCurrentChatRoom(newRoom.id);
        this.loadInitialMessages();
      } else {
        this.chatService.setCurrentChatRoom(null);
        this.chatService.clearCurrentMessages();
      }
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.chatService.setCurrentChatRoom(null);
  }

  private clearInitialContext(): void {
    this.initialContextProductId = null;
    this.initialContextProductName = null;
    this.initialContextProductSlug = null;
    this.contextHasBeenSentForThisRoom = true;
  }

  loadInitialMessages(): void {
    if (!this.selectedRoom) return;
    this.currentPage = 0;
    this.hasMoreMessages.set(true);
    this.chatService.getChatMessages(this.selectedRoom.id, this.currentPage, this.pageSize)
      .subscribe({
        next: res => {
          if (res.success && res.data) {
            this.hasMoreMessages.set(!res.data.last);
            setTimeout(() => this.scrollToBottom('auto'), 50);
          }
        },
        error: err => this.errorMessage.set(err.error?.message || 'Lỗi tải tin nhắn.')
      });
  }

  loadPreviousMessages(): void {
    if (!this.selectedRoom || this.isLoadingMore() || !this.hasMoreMessages()) return;
    this.isLoadingMore.set(true);
    this.currentPage++;
    const container = this.messageContainer.nativeElement;
    const oldScrollHeight = container.scrollHeight;

    this.chatService.getChatMessages(this.selectedRoom.id, this.currentPage, this.pageSize)
      .pipe(finalize(() => this.isLoadingMore.set(false)))
      .subscribe(res => {
        if (res.success && res.data) {
          this.hasMoreMessages.set(!res.data.last);
          setTimeout(() => {
            container.scrollTop = container.scrollHeight - oldScrollHeight;
          }, 0);
        }
      });
  }

  sendMessage(): void {
    if (this.messageForm.invalid || !this.selectedRoom?.otherUser) return;
    const contentToSend = this.messageForm.value.content?.trim();
    if (!contentToSend) return;

    const request: ChatMessageRequest = {
      recipientId: this.selectedRoom.otherUser.id,
      content: contentToSend,
      messageType: MessageType.TEXT,
      contextProductId: !this.contextHasBeenSentForThisRoom ? this.initialContextProductId : null,
      contextProductName: !this.contextHasBeenSentForThisRoom ? this.initialContextProductName : null,
      contextProductSlug: !this.contextHasBeenSentForThisRoom ? this.initialContextProductSlug : null
    };

    this.chatService.sendMessageViaWebSocket(request);
    this.messageForm.reset();

    if (!this.contextHasBeenSentForThisRoom && this.initialContextProductId) {
      this.contextHasBeenSentForThisRoom = true;
    }
  }

  scrollToBottom(behavior: ScrollBehavior = 'auto'): void {
    try {
      if (this.messageContainer?.nativeElement) {
        const element = this.messageContainer.nativeElement;
        element.scrollTo({ top: element.scrollHeight, behavior: behavior });
      }
    } catch (err) {
      console.error("Could not scroll to bottom:", err);
    }
  }

  trackMessageById(index: number, message: ChatMessageResponse): number | string {
    return message.id > 0 ? message.id : `${message.id}-${message.sentAt}`;
  }

  shouldShowAvatar(allMessages: ChatMessageResponse[] | null, currentIndex: number): boolean {
    if (!allMessages || currentIndex < 0 || currentIndex >= allMessages.length) return false;
    if (currentIndex === 0) return true;
    const currentMessage = allMessages[currentIndex];
    const previousMessage = allMessages[currentIndex - 1];
    if (!currentMessage?.sender || !previousMessage?.sender) return true;
    return currentMessage.sender.id !== previousMessage.sender.id;
  }

  autoResizeTextarea(textarea: HTMLTextAreaElement): void {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  sendMessageOnEnter(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  onScroll(event: Event): void {
    const element = event.target as HTMLElement;
    if (element.scrollTop < 50 && this.hasMoreMessages() && !this.isLoadingMore() && !this.isLoading()) {
      this.loadPreviousMessages();
    }
  }
}
