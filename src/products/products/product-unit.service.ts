import { Repository } from 'typeorm';

import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { AlreadyExistException, IsBeingUsedException } from '../../common/exceptions/common.exception';

import { ProductUnitDto, ProductUnitSearchInputDto } from './dto';
import { ProductUnit } from './entities/product-unit.entity';

import { Company } from '../companies/entities/company.entity';

@Injectable()
export class ProductUnitService {

  private readonly logger = new Logger(ProductUnitService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,

    @InjectRepository(ProductUnit, 'productsConn')
    private readonly ProductUnitRepository: Repository<ProductUnit>
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateBatch(dtoList: ProductUnitDto[]): Promise<ProcessSummaryDto>{
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

  update(dto: ProductUnitDto): Promise<ProductUnitDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.ProductUnitRepository.findOne({
      where: { id: dto.id },
    })
    .then( (entity: ProductUnit) => {

      // * validate
      if(!entity){
        const msg = `entity not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg}), the creation will be executed`);
        return this.create(dto);
      }
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: ProductUnit) => this.save(entity) ) // * update
      .then( (entity: ProductUnit) => new ProductUnitDto(entity.company.id, entity.name, entity.id) )
      .then( (dto: ProductUnitDto) => {
        const end = performance.now();
        this.logger.log(`update: executed, runtime=${(end - start) / 1000} seconds`);
        return dto;
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`update: error=${error.message}`);
      throw error;
    })

  }

  create(dto: ProductUnitDto): Promise<ProductUnitDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * create
    return this.ProductUnitRepository.findOne({
      where: { name: dto.name, company: { id: dto.companyId } },
    })
    .then( (entity: ProductUnit) => {

      // * validate
      if(entity){
        const msg = `name already exists, name=${dto.name}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }
      
      return new ProductUnit();
    })
    .then( (entity: ProductUnit) => this.prepareEntity(entity, dto) )// * prepare
    .then( (entity: ProductUnit) => this.save(entity) ) // * update
    .then( (entity: ProductUnit) => new ProductUnitDto(entity.company.id, entity.name, entity.id) )
    .then( (dto: ProductUnitDto) => {
      const end = performance.now();
      this.logger.log(`create: executed, runtime=${(end - start) / 1000} seconds`);
      return dto;
    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`create: error=${error.message}`);
      throw error;
    })
    
  }

  async removeBatch(idList: string[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`removeBatch: starting process... listSize=${idList.length}`);
    const start = performance.now();
    
    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(idList.length);
    let i = 0;
    for (const id of idList) {
      
      await this.remove(id)
      .then( () => {
        processSummaryDto.rowsOK++;
        processSummaryDto.detailsRowsOK.push(`(${i++}) id=${id}, message=OK`);
      })
      .catch(error => {
        processSummaryDto.rowsKO++;
        processSummaryDto.detailsRowsKO.push(`(${i++}) id=${id}, error=${error}`);
      })

    }
    
    const end = performance.now();
    this.logger.log(`removeBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processSummaryDto;
  }

  remove(id: string): Promise<string> {
    this.logger.log(`remove: starting process... id=${id}`);
    const start = performance.now();

    return this.ProductUnitRepository.findOne({
      where: { id },
    })
    .then( (entity: ProductUnit) => {

      // * validate
      if(!entity){
        const msg = `entity not found, id=${id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }
      
      // * delete: update field active
      entity.active = false;
      return entity;
    })
    .then( (entity: ProductUnit) => this.save(entity) )
    .then( (entity: ProductUnit) => {
      const end = performance.now();
      this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
      return 'deleted';
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'entity is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  searchByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductUnitSearchInputDto): Promise<ProductUnitDto[]> {
    const start = performance.now();

    return this.searchEntitiesByValues(companyId, paginationDto, inputDto)
    .then( (entityList: ProductUnit[]) => entityList.map( (entity) => new ProductUnitDto(entity.company.id, entity.name, entity.id) ) )
    .then( (dtoList: ProductUnitDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `entities not found, inputDto=${JSON.stringify(inputDto)}`;
        this.logger.warn(`searchByValues: ${msg}`);
        throw new NotFoundException(msg);
      }

      const end = performance.now();
      this.logger.log(`searchByValues: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`searchByValues: error`, error);
      throw error;
    })
    
  }
  
  private prepareEntity(entity: ProductUnit, dto: ProductUnitDto): Promise<ProductUnit> {
  
    try {
      const company = new Company();
      company.id = dto.companyId;

      entity.id           = dto.id ? dto.id : undefined;
      entity.company      = company;
      entity.name         = dto.name.toUpperCase();

      return Promise.resolve(entity);

    } catch (error) {
      this.logger.error(`prepareEntity: error`, error);
      throw error;
    }
    
  }

  private save(entity: ProductUnit): Promise<ProductUnit> {
    const start = performance.now();

    const newEntity: ProductUnit = this.ProductUnitRepository.create(entity);

    return this.ProductUnitRepository.save(newEntity)
    .then( (entity: ProductUnit) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }

  private searchEntitiesByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductUnitSearchInputDto): Promise<ProductUnit[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    const query = this.ProductUnitRepository.createQueryBuilder('a')
    .leftJoinAndSelect('a.company', 'c')
    .where('a.companyId = :companyId', { companyId })
    .andWhere('a.active = :active', { active: true });

    if(inputDto.name) {
      const formatted = `%${inputDto.name?.toLowerCase().replace(' ', '%')}%`;
      query.andWhere('a.name LIKE :name', { name: formatted });
    }

    query.orderBy('a.name', 'DESC');

    return query
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  }

}
