export interface PendingRequest {
  kind: 'permission' | 'question';
  requestId: string;
}
