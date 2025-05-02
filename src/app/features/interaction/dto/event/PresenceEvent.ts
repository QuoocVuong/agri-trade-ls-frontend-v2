export interface PresenceEvent {
  userId: number;
  online: boolean; // Backend gửi 'online' là boolean
  username?: string; // Optional
  timestamp?: string; // Optional
}

