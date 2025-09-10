import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';  // Import Redis from ioredis
import { Worker } from 'bullmq';

import { MessageDto } from '../dto/message.dto';
import { ProcessEnum } from '../enums';
import { JsonBasic } from '../interfaces/json-basic.interface';

import { CompanyDto } from 'src/products/companies/dto/company.dto';
import { CompanyService } from 'src/products/companies/company.service';

import { UserDto } from 'src/products/users/dto/user.dto';
import { UserService } from 'src/products/users/user.service';

import { MovementDto } from 'src/products/products/dto/movement.dto';
import { MovementService } from 'src/products/products/movement.service';
import { ProductDto, ProductUnitDto } from 'src/products/products/dto';
import { ProductService } from 'src/products/products';
import { ProductUnitService } from 'src/products/products/product-unit.service';

@Injectable()
export class DataReceptionWorkerService implements OnModuleInit {

  private readonly logger = new Logger(DataReceptionWorkerService.name);
  
  private readonly redisHost: string = "";
  private readonly redisPort: number = 0;
  private readonly redisPassword: string = "";
  private readonly redisFamily: number = 0;
  private readonly redisJobQueueProducts: string = "";
  
  private workerProduct: Worker;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly movementService: MovementService,
    private readonly productUnitService: ProductUnitService
  ) {
    // * Retrieve the Redis configuration values from ConfigService
    this.redisHost = this.configService.get('redisHost');
    this.redisPort = this.configService.get('redisPort');
    this.redisPassword = this.configService.get('redisPassword');
    this.redisFamily = this.configService.get('redisFamily');
    this.redisJobQueueProducts = this.configService.get('redisJobQueueProducts');
  }

  // * Implementing OnModuleInit to initialize the worker when the module is loaded
  async onModuleInit() {
    
    // * Create the Redis client using ioredis
    const redisClient = new Redis({
      host: this.redisHost,
      port: this.redisPort,
      password: this.redisPassword,
      family: this.redisFamily,
      maxRetriesPerRequest: null
    });

    // * Create a BullMQ Worker to listen to the 'jobQueue' queue
    this.workerProduct = new Worker(this.redisJobQueueProducts, async job => {
      const start = performance.now();
      this.logger.log(`workerProduct: starting process... jobId=${job.id}, data: ${JSON.stringify(job.data)}`);

      return this.processJob(job.data)
      .then( (response: string) => {
        const end = performance.now();
        this.logger.log(`workerProduct: executed, runtime=${(end - start) / 1000} seconds, jobId=${job.id} response=${response}`);
        return true;
        
      })
      .catch( (error: Error) => {
        this.logger.error(error.stack);
        throw error;
      })
      
    }, {
      connection: redisClient,
    });

    this.logger.log('Worker initialized and listening for jobs...');
  }

  private processJob(messageDto: MessageDto): Promise<string> {
    //this.logger.log(`processJob: messageDto=${JSON.stringify(messageDto)}`);
    
    switch (messageDto.process) {

      case ProcessEnum.COMPANY_UPDATE: {
        const dtoList: CompanyDto[] = JSON.parse(messageDto.jsonData);
        return this.companyService.updateBatch(dtoList)
        .then( () => 'update company executed' )
      }
      case ProcessEnum.COMPANY_DELETE: {
        const dtoList: JsonBasic[] = JSON.parse(messageDto.jsonData);
        const idList = dtoList.map(value => value.id);
        return this.companyService.removeBatch(idList)
        .then( () => 'delete company executed' )
      }
      case ProcessEnum.USER_UPDATE: {
        const dtoList: UserDto[] = JSON.parse(messageDto.jsonData);
        return this.userService.updateBatch(dtoList)
        .then( () => 'update user executed' )
      }
      case ProcessEnum.USER_DELETE: {
        const dtoList: JsonBasic[] = JSON.parse(messageDto.jsonData);
        const idList = dtoList.map(value => value.id);
        return this.userService.removeBatch(idList)
        .then( () => 'delete user executed' )
      }
      // case ProcessEnum.PRODUCT_UPDATE: {
      //   const dtoList: ProductDto[] = JSON.parse(messageDto.jsonData);
      //   return this.productService.updateBatch(dtoList)
      //   .then( () => 'update product executed' )
      // }
      case ProcessEnum.MOVEMENT_UPDATE: {
        const dtoList: MovementDto[] = JSON.parse(messageDto.jsonData);
        return this.movementService.bulkUpdate(dtoList)
        .then( () => 'update movement executed' )
      }
      case ProcessEnum.MOVEMENT_DELETE: {
        const dto: JsonBasic = JSON.parse(messageDto.jsonData);
        return this.movementService.bulkRemoveByRelatedId(dto.id)
        .then( () => 'delete movement executed' )
      }
      // case ProcessEnum.PRODUCT_UNIT_UPDATE: {
      //   const dtoList: ProductUnitDto[] = JSON.parse(messageDto.jsonData);
      //   return this.productUnitService.updateBatch(dtoList)
      //   .then( () => 'update product unit executed' )
      // }
      // case ProcessEnum.PRODUCT_UNIT_DELETE: {
      //   const dtoList: JsonBasic[] = JSON.parse(messageDto.jsonData);
      //   const idList = dtoList.map(value => value.id);
      //   return this.productUnitService.removeBatch(idList)
      //   .then( () => 'delete product unit executed' )
      // }
      default: {
        this.logger.error(`process not implemented, process=${messageDto.process}`);
        return Promise.resolve('process not implemented');
        // throw new Error(`process not implement, process=${messageDto.process}`);
      }

    }

  }

}
