import { In, InsertResult, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { FormulaDto, FormulaElementDto } from './dto/formula.dto';
import { Formula } from './entities/formula.entity';
import { FormulaElement } from './entities/formula-element.entity';

import { Element } from './entities/element.entity';

import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';

@Injectable()
export class FormulaService {

  private readonly logger = new Logger(FormulaService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,
    
    @InjectRepository(Formula, 'productsConn')
    private readonly formulaRepository: Repository<Formula>,
    
    @InjectRepository(FormulaElement, 'productsConn')
    private readonly formulaElementRepository: Repository<FormulaElement>,

    @InjectRepository(Element, 'productsConn')
    private readonly elementRepository: Repository<Element>,

    private readonly companyService: CompanyService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateFormulaBatch(dtoList: FormulaDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateFormulaBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.updateFormula(dto)
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
    this.logger.log(`updateFormulaBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processSummaryDto;
  }

  updateFormula(dto: FormulaDto): Promise<FormulaDto> {
    if(!dto.id)
      return this.createFormula(dto); // * create
    
    this.logger.warn(`updateFormula: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`updateFormula: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);    
      }

      const company = companyList[0];

      // * find formula
      const inputDto: SearchInputDto = new SearchInputDto(dto.id);
        
      return this.findFormulasByParams({}, inputDto)
      .then( (entityList: Formula[]) => {

        // * validate
        if(entityList.length == 0){
          const msg = `formula not found, id=${dto.id}`;
          this.logger.warn(`updateFormula: not executed (${msg})`);
          throw new NotFoundException(msg);
          //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);  
        }

        let entity = entityList[0];

        // * update
        entity.company = company;
        entity.name = dto.name.toUpperCase();
        entity.cost = dto.cost;

        return this.saveFormula(entity) // * update formula
        .then( (entity: Formula) => this.updateFormulaElement(entity, dto.elementList) ) // * create formulaElement
        .then( (formulaElementList: FormulaElement[]) => this.generateFormulaWithElementList(entity, formulaElementList) ) // * generate formula with formulaElement
        .then( (dto: FormulaDto) => {
          const end = performance.now();
          this.logger.log(`updateFormula: executed, runtime=${(end - start) / 1000} seconds`);
          return dto;
          //return new ProductsResponseDto(HttpStatus.OK, 'updated OK', [dto]);
        })
        
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`updateFormula: error`, error);
      throw error;
    })

  }

  createFormula(dto: FormulaDto): Promise<FormulaDto> {
    this.logger.warn(`createFormula: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);

    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`createFormula: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);    
      }

      const company = companyList[0];

      // * find formula
      const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
      
      return this.findFormulasByParams({}, inputDto, company.id)
      .then( (entityList: Formula[]) => {
  
        // * validate
        if(entityList.length > 0){
          const msg = `formula already exists, name=${dto.name}`;
          this.logger.warn(`createFormula: not executed (${msg})`);
          throw new AlreadyExistException(msg);
          //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, msg);
        }
        
        // * create
        let entity = new Formula();
        entity.company = company;
        entity.name = dto.name.toUpperCase();
        entity.cost = dto.cost;
  
        return this.saveFormula(entity) // * create formula
        .then( (entity: Formula) => {
  
          return this.updateFormulaElement(entity, dto.elementList) // * create formulaElement
          .then( (formulaElementList: FormulaElement[]) => this.generateFormulaWithElementList(entity, formulaElementList) ) // * generate formula with formulaElement
          .then( (dto: FormulaDto) => {
  
            const end = performance.now();
            this.logger.log(`createFormula: created OK, runtime=${(end - start) / 1000} seconds`);
            return dto;
            //return new ProductsResponseDto(HttpStatus.OK, 'created OK', [dto]);
          })
  
        })
  
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`createFormula: error`, error);
      throw error;
    })
    
  }

  findFormulas(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<FormulaDto[]> {
    const start = performance.now();

    return this.findFormulasByParams(paginationDto, inputDto, companyId)
    .then( (entityList: Formula[]) => entityList.map( (entity) => this.generateFormulaWithElementList(entity, entity.formulaElement) ) )
    .then( (dtoList: FormulaDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `formulas not found`;
        this.logger.warn(`findFormulas: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findFormulas: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      this.logger.error(`findFormulas: error`, error);
      throw error;
    })
 
  }

  findOneFormulaByValue(companyId: string, value: string): Promise<FormulaDto[]> {
    const start = performance.now();
    const inputDto: SearchInputDto = new SearchInputDto(value);
        
    // * find element
    return this.findFormulasByParams({}, inputDto, companyId)
    .then( (entityList: Formula[]) => entityList.map( (entity) => this.generateFormulaWithElementList(entity, entity.formulaElement) ) )
    .then( (dtoList: FormulaDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `formula not found, value=${value}`;
        this.logger.warn(`findOneFormulaByValue: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findOneFormulaByValue: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findOneFormulaByValue: error`, error);
      throw error;
    })
    
  }

  removeFormula(id: string): Promise<string> {
    this.logger.log(`removeFormula: starting process... id=${id}`);
    const start = performance.now();

    // * find formula
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findFormulasByParams({}, inputDto)
    .then( (entityList: Formula[]) => {
  
      // * validate
      if(entityList.length == 0){
        const msg = `formula not found, id=${id}`;
        this.logger.warn(`removeFormula: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      // * delete
      return this.formulaRepository.delete(id) // * delete formula and formulaElement on cascade
      .then( () => {
        const end = performance.now();
        this.logger.log(`removeFormula: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new ProductsResponseDto(HttpStatus.OK, 'delete OK');

      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'formula is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
      }

      this.logger.error('removeFormula: error', error);
      throw error;
    })

  }
  
  // removeFormula(id: string): Promise<ProductsResponseDto> {
  //   this.logger.log(`removeFormula: starting process... id=${id}`);
  //   const start = performance.now();

  //   // * find formula
  //   const inputDto: SearchInputDto = new SearchInputDto(id);
    
  //   return this.findFormulasByParams({}, inputDto)
  //   .then( (entityList: Formula[]) => {
  
  //     // * validate
  //     if(entityList.length == 0){
  //       const msg = `formula not found, id=${id}`;
  //       return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
  //     }

  //     const entity = entityList[0];
      
  //     // TODO: Posiblemente eliminar los formula-element se deba hacer via CASCADE true
  //     // * remove
  //     return this.formulaElementRepository.findBy( { formula: entity } ) // * find formulaElement
  //     .then( (formulaElementList: FormulaElement[]) => this.formulaElementRepository.remove(formulaElementList)) // * remove formulaElements
  //     .then( () => this.formulaRepository.remove(entity) ) // * remove formula
  //     .then( (entity: Formula) => {

  //       const end = performance.now();
  //       this.logger.log(`removeFormula: OK, runtime=${(end - start) / 1000} seconds`);
  //       return new ProductsResponseDto(HttpStatus.OK, 'delete OK');

  //     })

  //   })
  //   .catch(error => {
  //     if(error.errno == 1217) {
  //       this.logger.warn('removeFormula: not executed, error', error);
  //       return new ProductsResponseDto(HttpStatus.BAD_REQUEST, 'formula is being used');
  //     }

  //     this.logger.error('removeFormula: error', error);
  //     throw error;
  //   })

  // }

  private findFormulasByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Formula[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by partial name
    if(inputDto.search) {
      const whereByName = { company: { id: companyId }, name: Like(`%${inputDto.search}%`), active: true };
      const whereById   = { id: inputDto.search, active: true };
      const where = isUUID(inputDto.search) ? whereById : whereByName;

      return this.formulaRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where,
        relations: {
          formulaElement: true
        }
      })
    }

    // * search by names
    if(inputDto.searchList) {
      return this.formulaRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          company: { 
            id: companyId 
          },
          name: In(inputDto.searchList),
          active: true,
        },
        relations: {
          formulaElement: true
        }
      })
    }

    // * search all
    return this.formulaRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { 
        company: { 
          id: companyId 
        },
        active: true },
      relations: {
        formulaElement: true
      }
    })
    
  }

  private saveFormula(entity: Formula): Promise<Formula> {
    const start = performance.now();

    const newEntity: Formula = this.formulaRepository.create(entity);

    return this.formulaRepository.save(newEntity)
    .then( (entity: Formula) => {
      const end = performance.now();
      this.logger.log(`saveFormula: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }

  private updateFormulaElement(formula: Formula, formulaElementDtoList: FormulaElementDto[] = []): Promise<FormulaElement[]> {
    this.logger.log(`updateFormulaElement: starting process... formula=${JSON.stringify(formula)}, formulaElementDtoList=${JSON.stringify(formulaElementDtoList)}`);
    const start = performance.now();

    if(formulaElementDtoList.length == 0){
      this.logger.warn(`updateFormulaElement: not executed (formula element list empty)`);
      return Promise.resolve([]);
    }

    // * find elements by id
    const elementIdList = formulaElementDtoList.map( (item) => item.id );

    return this.elementRepository.findBy({ // TODO: Posiblemente aca deberia utilizarse el servicio y no el repositorio
      id: In(elementIdList),
    })
    .then( (elementList: Element[]) => {

      // * validate
      if(elementList.length !== elementIdList.length){
        const elementIdNotFoundList: string[] = elementIdList.filter( (id) => !elementList.find( (element) => element.id == id) );
        const msg = `elements not found, idList=${JSON.stringify(elementIdNotFoundList)}`;
        throw new NotFoundException(msg); 
      }

      // * create formulaElement
      return this.formulaElementRepository.findBy( { formula } ) // * find formulaElement
      .then( (formulaElementList: FormulaElement[]) => this.formulaElementRepository.remove(formulaElementList)) // * remove formulaElements
      .then( () => {
        
        // * generate formula element list
        const formulaElementList: FormulaElement[] = elementList.map( (element: Element) => {
          const formulaElement = new FormulaElement();
          formulaElement.formula = formula;
          formulaElement.element = element;
          formulaElement.qty = formulaElementDtoList.find( (elementDto) => elementDto.id == element.id).qty;
          return formulaElement;
        })
  
        // * bulk insert
        return this.bulkInsertFormulaElements(formulaElementList)
        .then( (formulaElementList: FormulaElement[]) => {
          const end = performance.now();
          this.logger.log(`updateFormulaElement: OK, runtime=${(end - start) / 1000} seconds`);
          return formulaElementList;
        })

      })

    })

  }

  private bulkInsertFormulaElements(formulaElementList: FormulaElement[]): Promise<FormulaElement[]> {
    const start = performance.now();
    this.logger.log(`bulkInsertFormulaElements: starting process... listSize=${formulaElementList.length}`);

    const newFormulaElementList: FormulaElement[] = formulaElementList.map( (value) => this.formulaElementRepository.create(value));
    
    return this.formulaElementRepository.manager.transaction( async(transactionalEntityManager) => {
      
      return transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(FormulaElement)
        .values(newFormulaElementList)
        .execute()
        .then( (insertResult: InsertResult) => {
          const end = performance.now();
          this.logger.log(`bulkInsertFormulaElements: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
          return newFormulaElementList;
        })
    })
  }

  generateFormulaWithElementList(formula: Formula, formulaElementList: FormulaElement[]): FormulaDto {
    
    let formulaElementDtoList: FormulaElementDto[] = [];
    let cost: number = formula.cost;

    if(formulaElementList.length > 0){
      formulaElementDtoList = formulaElementList.map( (formulaElement: FormulaElement) => new FormulaElementDto(formulaElement.element.id, formulaElement.qty, formulaElement.element.name, formulaElement.element.cost, formulaElement.element.unit) );
      
      // * calculate cost
      cost = formulaElementDtoList.reduce( (cost, formulaElementDto) => cost + (formulaElementDto.qty * formulaElementDto.cost), 0);
    } 

    // * generate formula dto
    const formulaDto = new FormulaDto(formula.company.id, formula.name, cost, formulaElementDtoList, formula.id);

    return formulaDto;
  }

}
