export interface PublishMessage {
  name: string;
  producerId?: string;
  topic: string;
  payload: any;
  metadata?: any;
}
