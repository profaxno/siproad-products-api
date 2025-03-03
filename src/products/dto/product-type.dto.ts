import { IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ProductTypeDto {
  
  @IsUUID()
  @IsOptional()
  id?: string;

  @IsUUID()
  companyId: string;

  @IsString()
  @MaxLength(45)
  label: string;

  constructor(companyId: string, label: string, id?: string) {
    this.companyId = companyId;
    this.label = label;
    this.id = id;
  }
}
