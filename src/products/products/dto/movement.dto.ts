import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { ProductTypeEnum, UnitMeasuresEnum, MovementTypeEnum, MovementReasonEnum } from "../enums";

export class MovementDto {
  
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsOptional()
  @IsUUID()
  relatedId?: string;

  @IsOptional()
  @IsNumber()
  relatedCode?: number;
  
  @IsIn([MovementTypeEnum.OUT, MovementTypeEnum.IN])
  type: number;

  @IsIn([MovementReasonEnum.SALE, MovementReasonEnum.PURCHASE, MovementReasonEnum.ADJUSTMENT])
  reason: number;

  @IsNumber()
  qty: number;

  @IsUUID()
  productId: string;

  @IsUUID()
  userId: string;
  
  constructor(type: number, reason: number, qty: number, productId: string, userId: string, id?: string, relatedId?: string, relatedCode?: number){
    this.type = type;
    this.reason = reason;
    this.qty = qty;
    this.productId = productId;
    this.userId = userId;
    this.id = id;
    this.relatedId = relatedId;
    this.relatedCode = relatedCode;
  } 

}