import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { ProductTypeEnum, UnitMeasuresEnum, MovementTypeEnum, MovementReasonEnum } from "../enums";

export class MovementDto {
  
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsIn([MovementTypeEnum.OUT, MovementTypeEnum.IN])
  type: number;

  @IsIn([MovementReasonEnum.SALE, MovementReasonEnum.PURCHASE, MovementReasonEnum.ADJUSTMENT])
  reason: number;

  @IsNumber()
  qty: number;

  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  userId: string;
  
  constructor(type: number, reason: number, qty: number, productId: string, userId: string, id?: string, relatedId?: string){
    this.id = id;
    this.type = type;
    this.reason = reason;
    this.qty = qty;
    this.relatedId = relatedId;
    this.productId = productId;
    this.userId = userId;
  } 

}