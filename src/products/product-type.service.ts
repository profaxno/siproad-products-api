import { In, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ProductTypeDto } from './dto/product-type.dto';
import { ProductType, Company } from './entities';

import { CompanyService } from './company.service';
import { AlreadyExistException, IsBeingUsedException } from '../common/exceptions/common.exception';

@Injectable()
export class ProductTypeService {

  private readonly logger = new Logger(ProductTypeService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,

    @InjectRepository(ProductType, 'productsConn')
    private readonly productTypeRepository: Repository<ProductType>,

    private readonly companyService: CompanyService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }
  
  async updateBatch(dtoList: ProductTypeDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.update(dto)
      .then( () => {
        processSummaryDto.rowsOK++;
        processSummaryDto.detailsRowsOK.push(`(${i++}) name=${dto.label}, message=OK`);
      })
      .catch(error => {
        processSummaryDto.rowsKO++;
        processSummaryDto.detailsRowsKO.push(`(${i++}) name=${dto.label}, error=${error}`);
      })

    }
    
    const end = performance.now();
    this.logger.log(`updateBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processSummaryDto;
  }

  update(dto: ProductTypeDto): Promise<ProductTypeDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find productType
    const inputDto: SearchInputDto = new SearchInputDto(dto.id);
      
    return this.findByParams({}, inputDto)
    .then( (entityList: ProductType[]) => {

      // * validate
      if(entityList.length == 0){
        const msg = `productType not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * update
      const entity = entityList[0];
              
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: ProductType) => this.save(entity) ) // * update
      .then( (entity: ProductType) => {
        const dto = new ProductTypeDto(entity.company.id, entity.label, entity.id); // * map to dto

        const end = performance.now();
        this.logger.log(`update: executed, runtime=${(end - start) / 1000} seconds`);
        return dto;
      })
      
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`update: error`, error);
      throw error;
    })

  }

  create(dto: ProductTypeDto): Promise<ProductTypeDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find productType
    const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.label]);
      
    return this.findByParams({}, inputDto, dto.companyId)
    .then( (entityList: ProductType[]) => {

      // * validate
      if(entityList.length > 0){
        const msg = `productType already exists, name=${dto.label}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }

      // * create
      const entity = new ProductType();
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: ProductType) => this.save(entity) ) // * update
      .then( (entity: ProductType) => {
        const dto = new ProductTypeDto(entity.company.id, entity.label, entity.id); // * map to dto 

        const end = performance.now();
        this.logger.log(`create: OK, runtime=${(end - start) / 1000} seconds`);
        return dto;
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`create: error`, error);
      throw error;
    })

  }

  find(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ProductTypeDto[]> {
    const start = performance.now();

    return this.findByParams(paginationDto, inputDto, companyId)
    .then( (entityList: ProductType[]) => entityList.map( (entity: ProductType) => new ProductTypeDto(entity.company.id, entity.label, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ProductTypeDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `productTypes not found`;
        this.logger.warn(`find: ${msg}`);
        throw new NotFoundException(msg);
      }

      const end = performance.now();
      this.logger.log(`find: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`find: error`, error);
      throw error;
    })

  }

  findOneById(id: string, companyId?: string): Promise<ProductTypeDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto, companyId)
    .then( (entityList: ProductType[]) => entityList.map( (entity: ProductType) => new ProductTypeDto(entity.company.id, entity.label, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ProductTypeDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `productType not found, id=${id}`;
        this.logger.warn(`findOneById: ${msg}`);
        throw new NotFoundException(msg);
      }

      const end = performance.now();
      this.logger.log(`findOneById: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findOneById: error`, error);
      throw error;
    })

  }

  remove(id: string): Promise<string> {
    this.logger.log(`remove: starting process... id=${id}`);
    const start = performance.now();

    // * find productType
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto)
    .then( (entityList: ProductType[]) => {
      
      if(entityList.length == 0){
        const msg = `productType not found, id=${id}`;
        this.logger.warn(`remove: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * delete
      return this.productTypeRepository.delete(id)
      .then( () => {
        const end = performance.now();
        this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'productType is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  findByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<ProductType[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by id or partial value
    const value = inputDto.search
    if(value) {
      const whereById   = { id: value };
      const whereByName = { company: { id: companyId}, label: Like(`%${value}%`) };
      const where       = isUUID(value) ? whereById : whereByName;

      return this.productTypeRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where
      })
    }

    // * search by value list
    if(inputDto.searchList) {
      return this.productTypeRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          company: {
            id: companyId
          },
          label: In(inputDto.searchList)
        }
      })
    }

    // * search all
    return this.productTypeRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { 
        company: {
          id: companyId
        }
      }
    })
    
  }

  private prepareEntity(entity: ProductType, dto: ProductTypeDto): Promise<ProductType> {
    
    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      entity.company = companyList[0];
      entity.label = dto.label.toUpperCase();
      
      return entity;
      
    })
    
  }

  private save(entity: ProductType): Promise<ProductType> {
    const start = performance.now();

    const newEntity: ProductType = this.productTypeRepository.create(entity);

    return this.productTypeRepository.save(newEntity)
    .then( (entity: ProductType) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }
  
}
