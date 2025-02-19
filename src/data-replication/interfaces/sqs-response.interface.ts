export interface SqsResponse {
  $metadata:        Metadata;
  MD5OfMessageBody: string;
  MessageId:        string;
}

export interface Metadata {
  httpStatusCode:  number;
  requestId:       string;
  attempts:        number;
  totalRetryDelay: number;
}
