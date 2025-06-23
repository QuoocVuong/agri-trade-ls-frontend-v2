import { ChatMessageResponse } from './ChatMessageResponse';
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse';

export interface ChatRoomResponse {
  id: number;
  user1: UserInfoSimpleResponse | null;
  user2: UserInfoSimpleResponse | null;
  lastMessage: ChatMessageResponse | null;
  lastMessageTime: string | null;
  user1UnreadCount: number;
  user2UnreadCount: number;

  myUnreadCount?: number;
  otherUser?: UserInfoSimpleResponse | null;
  createdAt: string;
  updatedAt: string;
}
