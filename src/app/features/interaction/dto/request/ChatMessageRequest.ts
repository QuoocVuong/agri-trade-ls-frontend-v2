import { MessageType } from '../../domain/message-type.enum';

export interface ChatMessageRequest {
  recipientId: number;
  content: string;
  messageType?: MessageType; // Optional, defaults to TEXT

  contextProductId?: number | null;
  contextProductName?: string | null;
  contextProductSlug?: string | null;
   contextProductThumbnailUrl?: string | null; // Nếu bạn quyết định gửi cả thumbnail
}
