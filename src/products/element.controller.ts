import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Controller, Get, Post, Body, Patch, Param, Delete, Logger, HttpCode, HttpStatus, Query, ParseUUIDPipe, ParseArrayPipe, NotFoundException } from '@nestjs/common';

import { ElementDto } from './dto/element.dto';
import { ProductsResponseDto } from './dto/products-response-dto';
import { ElementService } from './element.service';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Controller('siproad-products')
export class ElementController {

  private readonly logger = new Logger(ElementController.name);

  constructor(
    private readonly elementService: ElementService
  ) {}

  @Patch('/elements/update')
  @HttpCode(HttpStatus.OK)
  updateElement(@Body() dto: ElementDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateElement: dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.elementService.updateElement(dto)
    .then( (dto: ElementDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, 'executed', 1, [dto]);
      const end = performance.now();
      this.logger.log(`<<< updateElement: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);
      
      if(error instanceof AlreadyExistException)
        return new ProductsResponseDto(HttpStatus.BAD_REQUEST, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }

  @Post('/elements/updateBatch')
  @HttpCode(HttpStatus.OK)
  updateElementBatch(@Body() dtoList: ElementDto[]): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateElementBatch: listSize=${dtoList.length}`);
    const start = performance.now();

    return this.elementService.updateElementBatch(dtoList)
    .then( (processSummaryDto: ProcessSummaryDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", undefined, processSummaryDto);
      const end = performance.now();
      this.logger.log(`<<< updateElementBatch: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }

  @Get('/elements/:companyId')
  findElements(@Param('companyId', ParseUUIDPipe) companyId: string, @Query() paginationDto: SearchPaginationDto, @Body() inputDto: SearchInputDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findElements: companyId=${companyId}, paginationDto=${JSON.stringify(paginationDto)}, inputDto=${JSON.stringify(inputDto)}`);
    const start = performance.now();
    
    return this.elementService.findElements(companyId, paginationDto, inputDto)
    .then( (dtoList: ElementDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findElements: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }

  @Get('/elements/:companyId/:value')
  findOneElementByValue(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('value') value: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findOneElementByValue: companyId=${companyId}, value=${value}`);
    const start = performance.now();

    return this.elementService.findOneElementByValue(companyId, value)
    .then( (dtoList: ElementDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findOneElementByValue: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }

  @Delete('elements/:id')
  removeElement(@Param('id', ParseUUIDPipe) id: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> removeElement: id=${id}`);
    const start = performance.now();

    return this.elementService.removeElement(id)
    .then( (msg: string) => {
      const response = new ProductsResponseDto(HttpStatus.OK, msg);
      const end = performance.now();
      this.logger.log(`<<< removeElement: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);
      
      if(error instanceof IsBeingUsedException)
        return new ProductsResponseDto(HttpStatus.BAD_REQUEST, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }
  
}
