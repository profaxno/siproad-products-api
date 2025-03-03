export class ResponseDto {
  internalCode: number;
  message: string;
  qty?: number;
  payload?: any;

  constructor(internalCode: number, message: string, qty?: number, payload?: any) {
    this.internalCode = internalCode;
    this.message = message;
    this.qty = qty;
    this.payload = payload;
  }
}