import { IsArray, IsOptional, IsString } from "class-validator";
import { MovementReasonEnum, MovementTypeEnum, ProductTypeEnum } from "../enums";

export class MovementSearchInputDto {
  
  @IsString()
  productId: string;

  @IsOptional()
  @IsString()
  createdAtInit?: string;

  @IsOptional()
  @IsString()
  createdAtEnd?: string;
  
  @IsOptional()
  @IsArray()
  movementTypeList?: MovementTypeEnum[];

  @IsOptional()
  @IsArray()
  movementReasonList?: MovementReasonEnum[];
  
  constructor(productId: string, createdAtInit?: string, createdAtEnd?: string, movementTypeList?: MovementTypeEnum[], movementReasonList?: MovementReasonEnum[]) {
    this.productId = productId;
    this.createdAtInit = createdAtInit;
    this.createdAtEnd = createdAtEnd;
    this.movementTypeList = movementTypeList;
    this.movementReasonList = movementReasonList;
  }

}