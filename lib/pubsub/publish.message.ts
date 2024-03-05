export interface PublishMessage {
  id: string;
  name: string;
  producerId?: string;
  topic: string;
  payload: any;
  metadata?: any;
  contentType?: string;
}
