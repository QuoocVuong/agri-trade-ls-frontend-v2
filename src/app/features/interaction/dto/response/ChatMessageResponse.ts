import { MessageType } from '../../domain/message-type.enum';
import { UserInfoSimpleResponse } from '../../../user-profile/dto/response/UserInfoSimpleResponse'; // Correct path

export interface ChatMessageResponse {
    id: number;
    roomId: number;
    sender: UserInfoSimpleResponse | null; // Allow null if sender info not always needed/available
    recipient: UserInfoSimpleResponse | null;
    content: string;
    messageType: MessageType;
    sentAt: string; // ISO date string
    isRead: boolean;
    readAt: string | null; // ISO date string or null
}
