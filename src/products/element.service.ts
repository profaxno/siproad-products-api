import { In, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ElementDto } from './dto/element.dto';
import { Element } from './entities/element.entity';

import { Company } from './entities/company.entity';
import { CompanyService } from './company.service';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Injectable()
export class ElementService {

  private readonly logger = new Logger(ElementService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,

    @InjectRepository(Element, 'productsConn')
    private readonly elementRepository: Repository<Element>,

    private readonly companyService: CompanyService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }
  
  async updateElementBatch(dtoList: ElementDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateElementBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.updateElement(dto)
      .then( () => {
        processSummaryDto.rowsOK++;
        processSummaryDto.detailsRowsOK.push(`(${i++}) name=${dto.name}, message=OK`);
      })
      .catch(error => {
        processSummaryDto.rowsKO++;
        processSummaryDto.detailsRowsKO.push(`(${i++}) name=${dto.name}, error=${error}`);
      })

    }
    
    const end = performance.now();
    this.logger.log(`updateElementBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processSummaryDto;
  }

  updateElement(dto: ElementDto): Promise<ElementDto> {
    if(!dto.id)
      return this.createElement(dto); // * create
    
    this.logger.warn(`updateElement: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`updateElement: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);    
      }

      const company = companyList[0];

      // * find element
      const inputDto: SearchInputDto = new SearchInputDto(dto.id);
        
      return this.findElementsByParams({}, inputDto)
      .then( (entityList: Element[]) => {

        // * validate
        if(entityList.length == 0){
          const msg = `element not found, id=${dto.id}`;
          this.logger.warn(`updateElement: not executed (${msg})`);
          throw new NotFoundException(msg);
          //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);  
        }
  
        let entity = entityList[0];
        
        // * update
        entity.company = company;
        entity.name = dto.name.toUpperCase();
        entity.cost = dto.cost;
        entity.stock = dto.stock;
        entity.unit = dto.unit;
        
        return this.saveElement(entity)
        .then( (entity: Element) => {
          const dto = new ElementDto(entity.company.id, entity.name, entity.cost, entity.stock, entity.unit, entity.id); // * map to dto
  
          const end = performance.now();
          this.logger.log(`updateElement: executed, runtime=${(end - start) / 1000} seconds`);
          return dto;
          //return new ProductsResponseDto(HttpStatus.OK, 'updated OK', [dto]);
        })
        
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`updateElement: error`, error);
      throw error;
    })

  }

  createElement(dto: ElementDto): Promise<ElementDto> {
    this.logger.warn(`createElement: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`createElement: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);    
      }

      const company = companyList[0];

      // * find element
      const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
        
      return this.findElementsByParams({}, inputDto, company.id)
      .then( (entityList: Element[]) => {

        // * validate
        if(entityList.length > 0){
          const msg = `element already exists, name=${dto.name}`;
          this.logger.warn(`createElement: not executed (${msg})`);
          throw new AlreadyExistException(msg);
          //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, msg);
        }
  
        // * create
        let entity = new Element();
        entity.company = company;
        entity.name = dto.name.toUpperCase()
        entity.cost = dto.cost;
        entity.stock = dto.stock;
        entity.unit = dto.unit;
  
        return this.saveElement(entity)
        .then( (entity: Element) => {
          const dto = new ElementDto(entity.company.id, entity.name, entity.cost, entity.stock, entity.unit, entity.id); // * map to dto 

          const end = performance.now();
          this.logger.log(`createElement: OK, runtime=${(end - start) / 1000} seconds`);
          return dto;
          //return new ProductsResponseDto(HttpStatus.OK, 'created OK', [dto]);
        })
  
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`createElement: error`, error);
      throw error;
    })

  }

  findElements(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ElementDto[]> {
    const start = performance.now();

    return this.findElementsByParams(paginationDto, inputDto, companyId)
    .then( (entityList: Element[]) => entityList.map( (entity: Element) => new ElementDto(entity.company.id, entity.name, entity.cost, entity.stock, entity.unit, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ElementDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `elements not found`;
        this.logger.warn(`findElements: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg, []);
      }

      const end = performance.now();
      this.logger.log(`findElements: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findElements: error`, error);
      throw error;
    })

  }

  findOneElementByValue(companyId: string, value: string): Promise<ElementDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(value);
    
    return this.findElementsByParams({}, inputDto, companyId)
    .then( (entityList: Element[]) => entityList.map( (entity: Element) => new ElementDto(entity.company.id, entity.name, entity.cost, entity.stock, entity.unit, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ElementDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `element not found, value=${value}`;
        this.logger.warn(`findOneElementByValue: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg, []);
      }

      const end = performance.now();
      this.logger.log(`findOneElementByValue: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findOneElementByValue: error`, error);
      throw error;
    })

  }

  removeElement(id: string): Promise<string> {
    this.logger.log(`removeElement: starting process... id=${id}`);
    const start = performance.now();

    // * find element
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findElementsByParams({}, inputDto)
    .then( (entityList: Element[]) => {
      
      if(entityList.length == 0){
        const msg = `element not found, id=${id}`;
        this.logger.warn(`removeElement: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      // * delete
      return this.elementRepository.delete(id)
      .then( () => {
        const end = performance.now();
        this.logger.log(`removeElement: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new ProductsResponseDto(HttpStatus.OK, 'delete OK');
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'element is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
      }

      this.logger.error('removeElement: error', error);
      throw error;
    })

  }

  private findElementsByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Element[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by partial name
    const value = inputDto.search
    if(value) {
      const whereByName = { company: { id: companyId}, name: Like(`%${inputDto.search}%`), active: true };
      const whereById   = { id: value, active: true };
      const where = isUUID(value) ? whereById : whereByName;

      return this.elementRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where
      })
    }

    // * search by names
    if(inputDto.searchList) {
      return this.elementRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          company: {
            id: companyId
          },
          name: In(inputDto.searchList),
          active: true,
        }
      })
    }

    // * search all
    return this.elementRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { 
        company: {
          id: companyId
        },
        active: true }
    })
    
  }

  private saveElement(entity: Element): Promise<Element> {
    const start = performance.now();

    const newEntity: Element = this.elementRepository.create(entity);

    return this.elementRepository.save(newEntity)
    .then( (entity: Element) => {
      const end = performance.now();
      this.logger.log(`saveElement: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }
  
}
