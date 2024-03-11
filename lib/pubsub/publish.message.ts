export interface PublishMessage {
  pubSubName: string;
  producerId?: string;
  topic: string;
  payload: any;
  metadata?: any;
  contentType?: string;
}
