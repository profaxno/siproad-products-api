import { IsArray, IsOptional, IsString } from "class-validator";
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
  
  constructor(nameCode?: string, productTypeList?: ProductTypeEnum[], productCategoryId?: string) {
    this.nameCode = nameCode;
    this.productTypeList = productTypeList;
    this.productCategoryId = productCategoryId;
  }

}