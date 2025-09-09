import { Transform, Type } from "class-transformer";
import { IsBoolean, IsOptional, IsPositive, Min } from "class-validator";
import { SearchPaginationDto } from "profaxnojs/util";

export class ProductSearchInputQueryDto extends SearchPaginationDto {
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
    withMovements?: boolean;

    constructor(page?: number, limit?: number, withMovements?: boolean) {
        super(page, limit);
        this.withMovements = withMovements;
    }
}