import { IsArray, IsBoolean, IsOptional, IsString } from "class-validator";
import { ProductTypeEnum } from "../enums";

export class ProductSearchInputDto {
  
  @IsOptional()
  @IsString()
  nameCode?: string;
  
  @IsOptional()
  @IsArray()
  productTypeList?: ProductTypeEnum[];

  @IsOptional()
  @IsString()
  productCategoryId?: string;

  @IsOptional()
  @IsBoolean()
  enable4Sale?: boolean;
  
  constructor(nameCode?: string, productTypeList?: ProductTypeEnum[], productCategoryId?: string, enable4Sale?: boolean) {
    this.nameCode = nameCode;
    this.productTypeList = productTypeList;
    this.productCategoryId = productCategoryId;
    this.enable4Sale = enable4Sale;
  }

}