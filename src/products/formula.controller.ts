import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Controller, Get, Body, Patch, Param, Delete, Logger, HttpCode, HttpStatus, Query, ParseUUIDPipe, ParseArrayPipe, NotFoundException, Post } from '@nestjs/common';

import { FormulaDto } from './dto/formula.dto';
import { ProductsResponseDto } from './dto/products-response-dto';
import { FormulaService } from './formula.service';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Controller('siproad-products')
export class FormulaController {

  private readonly logger = new Logger(FormulaController.name);

  constructor(
    private readonly formulaService: FormulaService
  ) {}

  @Patch('/formulas/update')
  @HttpCode(HttpStatus.OK)
  updateFormula(@Body() dto: FormulaDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateFormula: dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.formulaService.updateFormula(dto)
    .then( (dto: FormulaDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, 'executed', 1, [dto]);
      const end = performance.now();
      this.logger.log(`<<< updateFormula: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
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

  @Post('/formulas/updateBatch')
  @HttpCode(HttpStatus.OK)
  updateFormulaBatch(@Body() dtoList: FormulaDto[]): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateFormulaBatch: listSize=${dtoList.length}`);
    const start = performance.now();

    return this.formulaService.updateFormulaBatch(dtoList)
    .then( (processSummaryDto: ProcessSummaryDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", undefined, processSummaryDto);
      const end = performance.now();
      this.logger.log(`<<< updateFormulaBatch: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }

  @Get('/formulas/:companyId')
  findFormulas(@Param('companyId', ParseUUIDPipe) companyId: string, @Query() paginationDto: SearchPaginationDto, @Body() inputDto: SearchInputDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findFormulas: companyId=${companyId}, paginationDto=${JSON.stringify(paginationDto)}, inputDto=${JSON.stringify(inputDto)}`);
    const start = performance.now();

    return this.formulaService.findFormulas(companyId, paginationDto, inputDto)
    .then( (dtoList: FormulaDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, 'executed', dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findFormulas: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }

  @Get('/formulas/:companyId/:value')
  findOneFormulaByValue(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('value') value: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findOneFormulaByValue: companyId=${companyId}, value=${value}`);
    const start = performance.now();

    return this.formulaService.findOneFormulaByValue(companyId, value)
    .then( (dtoList: FormulaDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, 'executed', dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findOneFormulaByValue: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }

  @Delete('formulas/:id')
  removeFormula(@Param('id', ParseUUIDPipe) id: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> removeFormula: id=${id}`);
    const start = performance.now();

    return this.formulaService.removeFormula(id)
    .then( (msg: string) => {
      const response = new ProductsResponseDto(HttpStatus.OK, msg);
      const end = performance.now();
      this.logger.log(`<<< removeFormula: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
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
