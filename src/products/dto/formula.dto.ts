import { ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class FormulaDto {
  
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
  
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaElementDto)
  elementList?: FormulaElementDto[];

  constructor(companyId: string, name: string, cost: number, elementList: FormulaElementDto[], id?: string){
    this.companyId = companyId;
    this.name = name;
    this.cost = cost;
    this.id = id;
    this.elementList = elementList;
  }
}

export class FormulaElementDto {
  @IsUUID()
  id: string;

  @IsNumber()
  qty: number;

  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  cost?: number;
  
  @IsString()
  @IsOptional()
  unit?: string;
  
  constructor(id: string, qty: number, name?: string, cost?: number, unit?: string){
    this.id = id;
    this.qty = qty;
    this.name = name;
    this.cost = cost;
    this.unit = unit;
  }
}
