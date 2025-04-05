import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import Redis from 'ioredis';  // Import Redis from ioredis
import { Worker } from 'bullmq';

import { MessageDto } from '../dto/message.dto';
import { ProcessEnum } from '../enums';
import { JsonBasic } from '../interfaces/json-basic.interface';

import { CompanyDto } from 'src/products/dto';
import { CompanyService } from 'src/products';


@Injectable()
export class DataReceptionWorkerService implements OnModuleInit {

  private readonly logger = new Logger(DataReceptionWorkerService.name);
  
  private readonly redisHost: string = "";
  private readonly redisPort: number = 0;
  private readonly redisPassword: string = "";
  private readonly redisFamily: number = 0;
  private readonly redisJobQueueAdminProducts: string = "";
  
  private workerAdminProducts: Worker;
  
  constructor(
    private readonly configService: ConfigService,
    private readonly companyService: CompanyService,
    // private readonly userService: UserService
  ) {
    // * Retrieve the Redis configuration values from ConfigService
    this.redisHost = this.configService.get('redisHost');
    this.redisPort = this.configService.get('redisPort');
    this.redisPassword = this.configService.get('redisPassword');
    this.redisFamily = this.configService.get('redisFamily');
    this.redisJobQueueAdminProducts = this.configService.get('redisJobQueueAdminProducts');
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
    this.workerAdminProducts = new Worker(this.redisJobQueueAdminProducts, async job => {
      const start = performance.now();
      this.logger.log(`workerAdminProducts: starting process... jobId=${job.id}, data: ${JSON.stringify(job.data)}`);

      return this.processJob(job.data)
      .then( (response: string) => {
        const end = performance.now();
        this.logger.log(`workerAdminProducts: executed, runtime=${(end - start) / 1000} seconds, jobId=${job.id} response=${response}`);
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
        const dto: CompanyDto = JSON.parse(messageDto.jsonData);
        return this.companyService.update(dto)
        .then( () => 'update company executed' )
      }
      case ProcessEnum.COMPANY_DELETE: {
        const dto: JsonBasic = JSON.parse(messageDto.jsonData);
        return this.companyService.remove(dto.id)
        .then( () => 'delete company executed' )
      }
      // case ProcessEnum.USER_UPDATE: {
      //   const dto: UserDto = JSON.parse(messageDto.jsonData);
      //   return this.userService.update(dto)
      //   .then( () => 'update user executed' )
      // }
      // case ProcessEnum.USER_DELETE: {
      //   const dto: JsonBasic = JSON.parse(messageDto.jsonData);
      //   return this.userService.remove(dto.id)
      //   .then( () => 'delete user executed' )
      // }
      default: {
        this.logger.error(`process not implemented, process=${messageDto.process}`);
        return Promise.resolve('process not implemented');
        // throw new Error(`process not implement, process=${messageDto.process}`);
      }

    }

  }

}
