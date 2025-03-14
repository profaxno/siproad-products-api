import { In, Like, Raw, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ElementTypeDto } from './dto/element-type.dto';
import { ElementType, Company } from './entities';

import { CompanyService } from './company.service';

import { AlreadyExistException, IsBeingUsedException } from '../common/exceptions/common.exception';

@Injectable()
export class ElementTypeService {

  private readonly logger = new Logger(ElementTypeService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,

    @InjectRepository(ElementType, 'productsConn')
    private readonly elementTypeRepository: Repository<ElementType>,

    private readonly companyService: CompanyService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }
  
  async updateBatch(dtoList: ElementTypeDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.update(dto)
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
    this.logger.log(`updateBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processSummaryDto;
  }

  update(dto: ElementTypeDto): Promise<ElementTypeDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find elementType
    const inputDto: SearchInputDto = new SearchInputDto(dto.id);
      
    return this.findByParams({}, inputDto)
    .then( (entityList: ElementType[]) => {

      // * validate
      if(entityList.length == 0){
        const msg = `elementType not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * update
      const entity = entityList[0];
              
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: ElementType) => this.save(entity) ) // * update
      .then( (entity: ElementType) => {
        dto = new ElementTypeDto(entity.company.id, entity.name, entity.id); // * map to dto

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

  create(dto: ElementTypeDto): Promise<ElementTypeDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find elementType
    const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
      
    return this.findByParams({}, inputDto, dto.companyId)
    .then( (entityList: ElementType[]) => {

      // * validate
      if(entityList.length > 0){
        const msg = `elementType already exists, name=${dto.name}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }

      // * create
      const entity = new ElementType();
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: ElementType) => this.save(entity) ) // * update
      .then( (entity: ElementType) => {
        dto = new ElementTypeDto(entity.company.id, entity.name, entity.id); // * map to dto 

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

  find(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ElementTypeDto[]> {
    const start = performance.now();

    return this.findByParams(paginationDto, inputDto, companyId)
    .then( (entityList: ElementType[]) => entityList.map( (entity: ElementType) => new ElementTypeDto(entity.company.id, entity.name, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ElementTypeDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `elementTypes not found`;
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

  findOneById(id: string, companyId?: string): Promise<ElementTypeDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto, companyId)
    .then( (entityList: ElementType[]) => entityList.map( (entity: ElementType) => new ElementTypeDto(entity.company.id, entity.name, entity.id) ) )// * map entities to DTOs
    .then( (dtoList: ElementTypeDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `elementType not found, id=${id}`;
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

    // * find elementType
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto)
    .then( (entityList: ElementType[]) => {
      
      if(entityList.length == 0){
        const msg = `elementType not found, id=${id}`;
        this.logger.warn(`remove: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * delete: update field active
      const entity = entityList[0];
      entity.active = false;

      return this.save(entity)
      .then( (entity: ElementType) => {

        const end = performance.now();
        this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'elementType is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  findByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<ElementType[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by id or partial value
    const value = inputDto.search;
    if(value) {
      const whereById     = { id: value };
      const whereByValue  = { company: { id: companyId}, name: value, active: true };
      const where = isUUID(value) ? whereById : whereByValue;

      return this.elementTypeRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where
      })
    }

    // * search by value list
    if(inputDto.searchList.length > 0) {
      return this.elementTypeRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          company: {
            id: companyId
          },
          name: Raw( (fieldName) => inputDto.searchList.map(value => `${fieldName} LIKE '%${value}%'`).join(' OR ') ),
          // name: In(inputDto.searchList),
          active: true
        }
      })
    }

    // * search all
    return this.elementTypeRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { 
        company: {
          id: companyId
        },
        active: true
      }
    })
    
  }

  private prepareEntity(entity: ElementType, dto: ElementTypeDto): Promise<ElementType> {
    
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
      entity.name = dto.name.toUpperCase();
      
      return entity;
      
    })
    
  }

  private save(entity: ElementType): Promise<ElementType> {
    const start = performance.now();

    const newEntity: ElementType = this.elementTypeRepository.create(entity);

    return this.elementTypeRepository.save(newEntity)
    .then( (entity: ElementType) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }
  
}
