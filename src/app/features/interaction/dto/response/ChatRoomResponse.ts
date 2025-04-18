import { ChatMessageResponse } from './ChatMessageResponse';
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse'; // Correct path

export interface ChatRoomResponse {
  id: number;
  user1: UserInfoSimpleResponse | null;
  user2: UserInfoSimpleResponse | null;
  lastMessage: ChatMessageResponse | null;
  lastMessageTime: string | null; // ISO date string or null
  user1UnreadCount: number;
  user2UnreadCount: number;
  // Frontend specific calculated fields:
  myUnreadCount?: number; // Calculated in service/component
  otherUser?: UserInfoSimpleResponse | null; // Calculated in service/component
  createdAt: string;
  updatedAt: string;
}
