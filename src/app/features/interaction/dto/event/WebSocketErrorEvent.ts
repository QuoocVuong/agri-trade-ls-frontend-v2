export interface WebSocketErrorEvent {
    error: string; // e.g., 'BadRequestException', 'InternalServerError'
    message: string;
}
