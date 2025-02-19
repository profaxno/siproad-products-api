import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Controller, Get, Body, Patch, Param, Delete, Logger, HttpCode, HttpStatus, Query, ParseUUIDPipe, ParseArrayPipe, NotFoundException, Post } from '@nestjs/common';

import { ProductDto } from './dto/product.dto';
import { ProductsResponseDto } from './dto/products-response-dto';
import { ProductService } from './product.service';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Controller('siproad-products')
export class ProductController {

  private readonly logger = new Logger(ProductController.name);

  constructor(
    private readonly productService: ProductService
  ) {}

  @Post('/products/updateBatch')
  @HttpCode(HttpStatus.OK)
  updateProductBatch(@Body() dtoList: ProductDto[]): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateProductBatch: listSize=${dtoList.length}`);
    const start = performance.now();

    return this.productService.updateProductBatch(dtoList)
    .then( (processSummaryDto: ProcessSummaryDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", undefined, processSummaryDto);
      const end = performance.now();
      this.logger.log(`<<< updateProductBatch: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }
  
  @Patch('/products/update')
  @HttpCode(HttpStatus.OK)
  updateProduct(@Body() dto: ProductDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> updateProduct: dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.productService.updateProduct(dto)
    .then( (dto: ProductDto) => {
      const response = new ProductsResponseDto(HttpStatus.OK, 'executed', 1, [dto]);
      const end = performance.now();
      this.logger.log(`<<< updateProduct: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
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

  @Get('/products/:companyId')
  findProducts(@Param('companyId', ParseUUIDPipe) companyId: string, @Query() paginationDto: SearchPaginationDto, @Body() inputDto: SearchInputDto): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findProducts: companyId=${companyId}, paginationDto=${JSON.stringify(paginationDto)}, inputDto=${JSON.stringify(inputDto)}`);
    const start = performance.now();
    
    return this.productService.findProducts(companyId, paginationDto, inputDto)
    .then( (dtoList: ProductDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findProducts: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })
  }

  @Get('/products/:companyId/:value')
  findOneProductByValue(@Param('companyId', ParseUUIDPipe) companyId: string, @Param('value') value: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> findOneProductByValue: companyId=${companyId}, value=${value}`);
    const start = performance.now();

    return this.productService.findOneProductByValue(companyId, value)
    .then( (dtoList: ProductDto[]) => {
      const response = new ProductsResponseDto(HttpStatus.OK, "executed", dtoList.length, dtoList);
      const end = performance.now();
      this.logger.log(`<<< findOneProductByValue: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
      return response;
    })
    .catch( (error: Error) => {
      if(error instanceof NotFoundException)
        return new ProductsResponseDto(HttpStatus.NOT_FOUND, error.message, 0, []);

      this.logger.error(error.stack);
      return new ProductsResponseDto(HttpStatus.INTERNAL_SERVER_ERROR, error.message);
    })

  }

  @Delete('products/:id')
  removeProduct(@Param('id', ParseUUIDPipe) id: string): Promise<ProductsResponseDto> {
    this.logger.log(`>>> removeProduct: id=${id}`);
    const start = performance.now();

    return this.productService.removeProduct(id)
    .then( (msg: string) => {
      const response = new ProductsResponseDto(HttpStatus.OK, msg);
      const end = performance.now();
      this.logger.log(`<<< removeProduct: executed, runtime=${(end - start) / 1000} seconds, response=${JSON.stringify(response)}`);
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
