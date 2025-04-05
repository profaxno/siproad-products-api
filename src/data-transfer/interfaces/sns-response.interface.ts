export interface SnsResponse {
  $metadata: Metadata;
  MessageId: string;
}

export interface Metadata {
  httpStatusCode:  number;
  requestId:       string;
  attempts:        number;
  totalRetryDelay: number;
}