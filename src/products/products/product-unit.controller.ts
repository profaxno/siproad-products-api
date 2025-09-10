import { PfxHttpResponseDto } from 'profaxnojs/axios';
import { SearchPaginationDto } from 'profaxnojs/util';

import { Controller, Get, Body, Patch, Param, Logger, HttpCode, HttpStatus, Query, ParseUUIDPipe, NotFoundException } from '@nestjs/common';

import { ProductUnitDto, ProductUnitSearchInputDto } from './dto';
import { ProductUnitService } from './product-unit.service';

import { AlreadyExistException } from '../../common/exceptions/common.exception';

@Controller('product-units')
export class ProductUnitController {

  private readonly logger = new Logger(ProductUnitController.name);

  constructor(
    private readonly ProductUnitService: ProductUnitService
  ) {}

  @Patch('/update')
  @HttpCode(HttpStatus.OK)
  update(@Body() dto: ProductUnitDto): Promise<PfxHttpResponseDto> {
    this.logger.log(`>>> update: dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.ProductUnitService.update(dto)
    .then( (dto: ProductUnitDto) => {
      const response = new PfxHttpResponseDto(HttpStatus.OK, 'executed', 1, [dto]);
      const end = performance.now();
      this.logger.log(`<<< update: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new PfxHttpResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      if(error instanceof AlreadyExistException)
        return new PfxHttpResponseDto(HttpStatus.BAD_REQUEST, error.message, 0, []);

      this.logger.error(error.stack);
      return new PfxHttpResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }

  @Get('/searchByValues/:companyId')
  searchByValues(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() paginationDto: SearchPaginationDto,
    @Body() inputDto: ProductUnitSearchInputDto
  ): Promise<PfxHttpResponseDto> {

    this.logger.log(`>>> searchByValues: companyId=${companyId}, paginationDto=${JSON.stringify(paginationDto)}, inputDto=${JSON.stringify(inputDto)}`);
    const start = performance.now();
    
    return this.ProductUnitService.searchByValues(companyId, paginationDto, inputDto)
    .then( (dtoList: ProductUnitDto[]) => {
      const response = new PfxHttpResponseDto(HttpStatus.OK, "executed", dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< searchByValues: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new PfxHttpResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new PfxHttpResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }
  
}
