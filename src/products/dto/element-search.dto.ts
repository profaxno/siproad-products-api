import { IsArray, IsOptional, IsString } from "class-validator";

export class ElementSearchInputDto {
  
  @IsOptional()
  @IsString()
  name?: string;
  
  @IsOptional()
  @IsString()
  elementTypeId?: string;
  
  constructor(name?: string, elementTypeId?: string) {
    this.name = name;
    this.elementTypeId = elementTypeId;
  }

}