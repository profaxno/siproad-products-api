import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from "class-validator";
import { MeasuresEnum } from "../enum/measures.enum";

export class ElementDto {
  
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  companyId: string;

  @IsString()
  @MaxLength(45)
  name: string;

  @IsNumber()
  cost: number;

  @IsNumber()
  stock: number;

  @IsIn([MeasuresEnum.UN, MeasuresEnum.KG])
  @MaxLength(5)
  unit: string;

  constructor(companyId: string, name: string, cost: number, stock: number, unit: string, id?: string) {
    this.companyId = companyId;
    this.name = name;
    this.cost = cost;
    this.stock = stock;
    this.unit = unit;
    this.id = id;
  }
}
