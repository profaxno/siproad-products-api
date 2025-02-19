import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator";
import { ProcessEnum, SourceEnum } from "../enum";

export class DataReplicationDto {
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => MessageDto)
    messageList: MessageDto[];

    constructor(messageList: MessageDto[]) {
        this.messageList = messageList;
    }
}

export class MessageDto {
    @IsIn([SourceEnum.API_ADMIN, SourceEnum.API_PRODUCTS])
    source: string;

    @IsIn([
        ProcessEnum.COMPANY_UPDATE,
        ProcessEnum.COMPANY_DELETE,
        ProcessEnum.PRODUCT_UPDATE,
        ProcessEnum.PRODUCT_DELETE])
    process: string;

    @IsString()
    jsonData: string;

    constructor(source: string, process: string, jsonData: string) {
        this.source = source;
        this.process = process;
        this.jsonData = jsonData;
    }
}