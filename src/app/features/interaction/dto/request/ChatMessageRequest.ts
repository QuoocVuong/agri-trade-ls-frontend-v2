import { MessageType } from '../../domain/message-type.enum';

export interface ChatMessageRequest {
  recipientId: number;
  content: string;
  messageType?: MessageType; // Optional, defaults to TEXT
}
