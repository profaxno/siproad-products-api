import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsPositive, IsString, ValidateNested } from "class-validator";
import { ProcessEnum, SourceEnum } from "../enums";

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
    source: SourceEnum;

    @IsIn([ProcessEnum.PRODUCT_UPDATE, ProcessEnum.PRODUCT_DELETE])
    process: ProcessEnum;

    @IsString()
    jsonData: string;

    constructor(source: SourceEnum, process: ProcessEnum, jsonData: string) {
        this.source = source;
        this.process = process;
        this.jsonData = jsonData;
    }
}