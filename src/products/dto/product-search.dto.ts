import { IsArray, IsOptional, IsString } from "class-validator";

export class ProductSearchInputDto {
  
  @IsOptional()
  @IsString()
  nameCode?: string;
  
  @IsOptional()
  @IsString()
  productTypeId?: string;
  
  constructor(nameCode?: string, productTypeId?: string) {
    this.nameCode = nameCode;
    this.productTypeId = productTypeId;
  }

}