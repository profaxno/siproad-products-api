import { In, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { CompanyDto } from './dto/company.dto';
import { Company } from './entities/company.entity';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Injectable()
export class CompanyService {

  private readonly logger = new Logger(CompanyService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,

    @InjectRepository(Company, 'productsConn')
    private readonly companyRepository: Repository<Company>,
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  updateCompany(dto: CompanyDto): Promise<CompanyDto> {
    if(!dto.id)
      return this.createCompany(dto); // * create
    
    this.logger.warn(`updateCompany: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(dto.id);
    
    return this.findCompaniesByParams({}, inputDto)
    .then( (entityList: Company[]) => {

      // * validate
      if(entityList.length == 0){
        this.logger.warn(`updateCompany: company not found, id=${dto.id}`);
        return this.createCompany(dto); // * create, if the dto has an id and the object is not found, the request may possibly come from data replication
      }

      let entity = entityList[0];
      
      // * update
      entity.name = dto.name.toUpperCase();
      
      return this.saveCompany(entity)
      .then( (entity: Company) => {
        const dto = new CompanyDto(entity.name, entity.id); // * map to dto

        const end = performance.now();
        this.logger.log(`updateCompany: executed, runtime=${(end - start) / 1000} seconds`);
        return dto;
        //return new ProductsResponseDto(HttpStatus.OK, 'updated OK', [dto]);
      })
      
    })
    .catch(error => {
      if(error instanceof AlreadyExistException)
        throw error;
      
      this.logger.error(`updateCompany: error`, error);
      throw error;
    })

  }

  createCompany(dto: CompanyDto): Promise<CompanyDto> {
    this.logger.warn(`createCompany: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
    
    return this.findCompaniesByParams({}, inputDto)
    .then( (entityList: Company[]) => {

      // * validate
      if(entityList.length > 0){
        const msg = `company already exists, name=${dto.name}`;
        this.logger.warn(`createCompany: not executed (${msg})`);
        throw new AlreadyExistException(msg);
        //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, msg);
      }

      // * create
      let entity = new Company();
      entity.id = dto.id ? dto.id : undefined;
      entity.name = dto.name.toUpperCase()
      
      return this.saveCompany(entity)
      .then( (entity: Company) => {
        const dto = new CompanyDto(entity.name, entity.id); // * map to dto

        const end = performance.now();
        this.logger.log(`createCompany: OK, runtime=${(end - start) / 1000} seconds`);
        return dto;
        //return new ProductsResponseDto(HttpStatus.OK, 'created OK', [dto]);
      })

    })
    .catch(error => {
      if(error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`createCompany: error`, error);
      throw error;
    })

  }

  findCompanies(paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<CompanyDto[]> {
    const start = performance.now();

    return this.findCompaniesByParams(paginationDto, inputDto)
    .then( (entityList: Company[]) => entityList.map( (entity: Company) => new CompanyDto(entity.name, entity.id) ) ) // * map entities to DTOs
    .then( (dtoList: CompanyDto[]) => {

      if(dtoList.length == 0){
        const msg = `companies not found`;
        this.logger.warn(`findCompanies: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findCompanies: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findCompanies: error`, error);
      throw error;
    })

  }

  findOneCompanyByValue(value: string): Promise<CompanyDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(value);
    
    return this.findCompaniesByParams({}, inputDto)
    .then( (entityList: Company[]) => entityList.map( (entity: Company) => new CompanyDto(entity.name, entity.id) ) ) // * map entities to DTOs
    .then( (dtoList: CompanyDto[]) => {

      if(dtoList.length == 0){
        const msg = `company not found, value=${value}`;
        this.logger.warn(`findOneCompanyByValue: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findOneCompanyByValue: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findOneCompanyByValue: error`, error);
      throw error;
    })
    
  }

  removeCompany(id: string): Promise<string> {
    this.logger.log(`removeCompany: starting process... id=${id}`);
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findCompaniesByParams({}, inputDto)
    .then( (entityList: Company[]) => {
      
      if(entityList.length == 0){
        const msg = `company not found, id=${id}`;
        this.logger.warn(`removeCompany: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      // * delete
      return this.companyRepository.delete(id)
      .then( () => {
        const end = performance.now();
        this.logger.log(`removeCompany: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new ProductsResponseDto(HttpStatus.OK, 'delete OK');
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'company is being used';
        this.logger.warn(`removeCompany: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
      }

      this.logger.error('removeCompany: error', error);
      throw error;
    })

  }

  findCompaniesByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<Company[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by partial name
    if(inputDto.search) {
      const whereByName = { name: Like(`%${inputDto.search}%`), active: true };
      const whereById   =  { id: inputDto.search, active: true };
      const where = isUUID(inputDto.search) ? whereById : whereByName;

      return this.companyRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where
      })
    }

    // * search by names
    if(inputDto.searchList) {
      return this.companyRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          name: In(inputDto.searchList),
          active: true,
        },
      })
    }

    // * search all
    return this.companyRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { active: true }
    })
    
  }

  private saveCompany(entity: Company): Promise<Company> {
    const start = performance.now();

    const newEntity: Company = this.companyRepository.create(entity);

    return this.companyRepository.save(newEntity)
    .then( (entity: Company) => {
      const end = performance.now();
      this.logger.log(`saveCompany: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }

}
