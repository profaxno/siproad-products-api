import { Brackets, In, InsertResult, Like, Raw, Repository } from 'typeorm';
import { DateFormatEnum, ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import * as moment from 'moment-timezone';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from '../users/entities/user.entity';

import { MovementDto, MovementSearchInputDto } from './dto';
import { Movement, Product } from './entities';

@Injectable()
export class MovementService {

  private readonly logger = new Logger(MovementService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,
    
    @InjectRepository(Movement, 'productsConn')
    private readonly movementRepository: Repository<Movement>,

  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  update(dtoList: MovementDto[]): Promise<void> {
    this.logger.warn(`update: starting process... dtoList=${JSON.stringify(dtoList)}`);
    const start = performance.now();

    const relatedId = dtoList[0].relatedId;

    return this.remove(relatedId)
    .then( () => dtoList.map( (value) => this.prepareEntity(new Movement(), value) ) )
    .then( (entityList: Movement[]) => this.bulkInsert(entityList) )
    .then( (entityList: Movement[]) => {
      const end = performance.now();
      this.logger.log(`update: OK, runtime=${(end - start) / 1000} seconds`);
    })

  }

  remove(relatedId: string): Promise<void> {
    this.logger.warn(`remove: starting process... relatedId=${relatedId}`);
    const start = performance.now();

    return this.movementRepository
    .createQueryBuilder('a')
    .where('a.relatedId = :relatedId', { relatedId })
    .getMany()
    .then( (movementList: Movement[]) => {
      if(movementList.length > 0)
        return this.movementRepository.remove(movementList);
      return [];
    })
    .then( (entityList: Movement[]) => {
      const end = performance.now();
      this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
    })

  }

  private bulkInsert(entityList: Movement[]): Promise<Movement[]> {
    const start = performance.now();
    this.logger.log(`bulkInsert: starting process... listSize=${entityList.length}`);

    const newEntityList: Movement[] = entityList.map( (value) => this.movementRepository.create(value));
    
    try {
      return this.movementRepository.manager.transaction( async(transactionalEntityManager) => {
        
        return transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(Movement)
        .values(newEntityList)
        .execute()
        .then( (insertResult: InsertResult) => {
          const end = performance.now();
          this.logger.log(`bulkInsert: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
          return newEntityList;
        })

      })

    } catch (error) {
      this.logger.error(`bulkInsert: error=${error.message}`);
      throw error;
    }
  }

  // create(dto: MovementDto): Promise<MovementDto> {
  //   this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
  //   const start = performance.now();

  //   try {
  //      const entity = new Movement();
      
  //     return this.prepareEntity(entity, dto) // * prepare entity
  //     .then( (entity: Movement) => this.save(entity) ) // * create/update entity
  //     .then( (entity: Movement) => {
  //       const dto = new MovementDto(entity.type, entity.reason, entity.qty, entity.product?.id, entity.user?.id, entity.id, entity.relatedId);
       
  //       const end = performance.now();
  //       this.logger.log(`create: created OK, runtime=${(end - start) / 1000} seconds`);
  //       return dto;
  //     })

  //   } catch (error) {
  //     this.logger.error(`create: error`, error);
  //     throw error;
  //   }

  // }

  searchByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: MovementSearchInputDto): Promise<MovementDto[]> {
    const start = performance.now();

    return this.searchEntitiesByValues(companyId, paginationDto, inputDto)
    .then( (entityList: Movement[]) => entityList.map( (entity) => new MovementDto(entity.type, entity.reason, entity.qty, entity.product?.id, entity.user?.id, entity.id, entity.relatedId) ) )
    .then( (dtoList: MovementDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `movements not found, inputDto=${JSON.stringify(inputDto)}`;
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

  // remove(relatedId: string): Promise<string> {
  //   this.logger.warn(`remove: starting process... id=${relatedId}`);
  //   const start = performance.now();

  //   // * find movement
  //   return this.movementRepository.findBy({ relatedId })
  //   .then( (entityList: Movement[]) => {
  
  //     // * validate
  //     if(entityList.length == 0){
  //       const msg = `movement not found, relatedId=${relatedId}`;
  //       this.logger.warn(`remove: not executed (${msg})`);
  //       throw new NotFoundException(msg);
  //     }
      
  //     // * delete: update field active
  //     const entity = entityList[0];
  //     entity.active = false;

  //     return this.save(entity)
  //     .then( (entity: Movement) => {

  //       const end = performance.now();
  //       this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
  //       return 'deleted';
  //     })

  //   })
  //   .catch(error => {
  //     if(error instanceof NotFoundException)
  //       throw error;

  //     if(error.errno == 1217) {
  //       const msg = 'movement is being used';
  //       this.logger.warn(`remove: not executed (${msg})`, error);
  //       throw new IsBeingUsedException(msg);
  //       //return new PfxHttpResponseDto(HttpStatus.BAD_REQUEST, 'movement is being used');
  //     }

  //     this.logger.error('remove: error', error);
  //     throw error;
  //   })

  // }

  private searchEntitiesByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: MovementSearchInputDto): Promise<Movement[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    const query = this.movementRepository.createQueryBuilder('a')
    .leftJoinAndSelect('a.product', 'p')
    .leftJoinAndSelect('a.user', 'u')
    .where('p.id = :productId', { productId: inputDto.productId })
    .andWhere('p.active = :active', { active: true });

    if(inputDto.createdAtInit) {
      const createdAtInit = moment.tz(inputDto.createdAtInit, DateFormatEnum.TIME_ZONE).utc().format(DateFormatEnum.DATETIME_FORMAT)
      query.andWhere('a.createdAt >= :createdAtInit', { createdAtInit: createdAtInit });
    }

    if(inputDto.createdAtEnd) {
      const createdAtEnd = moment.tz(inputDto.createdAtEnd, DateFormatEnum.TIME_ZONE).utc().format(DateFormatEnum.DATETIME_FORMAT)
      query.andWhere('a.createdAt <= :createdAtEnd', { createdAtEnd: createdAtEnd });
    }

    if (inputDto.movementTypeList?.length > 0) {
      query.andWhere('a.type IN (:...movementTypeList)', { movementTypeList: inputDto.movementTypeList});
    }

    if (inputDto.movementReasonList?.length > 0) {
      query.andWhere('a.reason IN (:...movementReasonList)', { movementReasonList: inputDto.movementReasonList});
    }
    
    return query
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  }

  private prepareEntity(entity: Movement, dto: MovementDto): Movement {

    const product = new Product();
    product.id = dto.productId;

    const user = new User();
    user.id = dto.userId;

    try {  
      // * prepare entity
      entity.id         = dto.id ? dto.id : undefined;
      entity.type       = dto.type;
      entity.reason     = dto.reason;
      entity.qty        = dto.qty;
      entity.relatedId  = dto.relatedId ? dto.relatedId : undefined;
      entity.product    = product;
      entity.user       = user;

      return entity;

    } catch( error ) {
      this.logger.error(`prepareEntity: error`, error);
      throw error;
    }
    
  }

  // private save(entity: Movement): Promise<Movement> {
  //   const start = performance.now();

  //   const newEntity: Movement = this.movementRepository.create(entity);

  //   return this.movementRepository.save(newEntity)
  //   .then( (entity: Movement) => {
  //     const end = performance.now();
  //     this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
  //     return entity;
  //   })
  // }

}
