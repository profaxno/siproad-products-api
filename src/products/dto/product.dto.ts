import { IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { FormulaElementDto } from "./formula.dto";

export class ProductDto {
  
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  companyId: string;

  @IsOptional()
  @IsUUID()
  productTypeId?: string;

  @IsString()
  @MaxLength(50)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  description: string;

  @IsNumber()
  cost: number;

  @IsNumber()
  price: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  imagenUrl?: string;

  @IsBoolean()
  hasFormula: boolean;

  // @IsOptional()
  // @IsBoolean()
  // active: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductElementDto)
  elementList?: ProductElementDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductFormulaDto)
  formulaList?: ProductFormulaDto[];

  constructor(companyId: string, name: string, cost: number, price: number, hasFormula: boolean, id?: string, code?: string, productTypeId?: string, description?: string, imagenUrl?: string/*, active?: boolean*/, elementList?: ProductElementDto[], formulaList?: ProductFormulaDto[]) {
    this.companyId = companyId;
    this.name = name;
    this.code = code;
    this.cost = cost;
    this.price = price;
    this.hasFormula = hasFormula;
    this.id = id;
    this.productTypeId = productTypeId;
    this.description = description;
    this.imagenUrl = imagenUrl;
    // this.active = active;
    this.elementList = elementList;
    this.formulaList = formulaList;
  }
}

export class ProductElementDto {
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

export class ProductFormulaDto {
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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormulaElementDto)
  elementList?: FormulaElementDto[];
  
  constructor(id: string, qty: number, name?: string, cost?: number, elementList?: FormulaElementDto[]){
    this.id = id;
    this.qty = qty;
    this.name = name;
    this.cost = cost;
    this.elementList = elementList;
  }
}
