import { In, InsertResult, Like, Raw, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { FormulaDto, FormulaElementDto } from './dto/formula.dto';
import { Formula, FormulaElement, Element, Company } from './entities';

import { CompanyService } from './company.service';

import { AlreadyExistException, IsBeingUsedException } from '../common/exceptions/common.exception';
import { ElementService } from './element.service';

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

    // @InjectRepository(Element, 'productsConn')
    // private readonly elementRepository: Repository<Element>,

    private readonly companyService: CompanyService,
    private readonly elementService: ElementService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateBatch(dtoList: FormulaDto[]): Promise<ProcessSummaryDto>{
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

  update(dto: FormulaDto): Promise<FormulaDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find formula
    const inputDto: SearchInputDto = new SearchInputDto(dto.id);
      
    return this.findByParams({}, inputDto)
    .then( (entityList: Formula[]) => {

      // * validate
      if(entityList.length == 0){
        const msg = `formula not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * update
      const entity = entityList[0];
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: Formula) => this.save(entity) ) // * update
      .then( (entity: Formula) => {
        
        return this.updateFormulaElement(entity, dto.elementList) // * create formulaElement
        .then( (formulaElementList: FormulaElement[]) => this.generateFormulaWithElementList(entity, formulaElementList) ) // * generate formula with formulaElement
        .then( (dto: FormulaDto) => {
          
          const end = performance.now();
          this.logger.log(`update: executed, runtime=${(end - start) / 1000} seconds`);
          return dto;
        })

      })
      
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`update: error`, error);
      throw error;
    })

  }

  create(dto: FormulaDto): Promise<FormulaDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find formula
    const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
    
    return this.findByParams({}, inputDto, dto.companyId)
    .then( (entityList: Formula[]) => {

      // * validate
      if(entityList.length > 0){
        const msg = `formula already exists, name=${dto.name}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }
      
      // * create
      const entity = new Formula();
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: Formula) => this.save(entity) ) // * update
      .then( (entity: Formula) => {

        return this.updateFormulaElement(entity, dto.elementList) // * create formulaElement
        .then( (formulaElementList: FormulaElement[]) => this.generateFormulaWithElementList(entity, formulaElementList) ) // * generate formula with formulaElement
        .then( (dto: FormulaDto) => {

          const end = performance.now();
          this.logger.log(`create: created OK, runtime=${(end - start) / 1000} seconds`);
          return dto;
        })

      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`create: error`, error);
      throw error;
    })
    
  }

  find(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<FormulaDto[]> {
    const start = performance.now();

    return this.findByParams(paginationDto, inputDto, companyId)
    .then( (entityList: Formula[]) => entityList.map( (entity) => this.generateFormulaWithElementList(entity, entity.formulaElement) ) )
    .then( (dtoList: FormulaDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `formulas not found`;
        this.logger.warn(`find: ${msg}`);
        throw new NotFoundException(msg);
      }

      const end = performance.now();
      this.logger.log(`find: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
    })
    .catch(error => {
      this.logger.error(`find: error`, error);
      throw error;
    })
 
  }

  findOneById(id: string, companyId?: string): Promise<FormulaDto[]> {
    const start = performance.now();
    const inputDto: SearchInputDto = new SearchInputDto(id);
        
    // * find element
    return this.findByParams({}, inputDto, companyId)
    .then( (entityList: Formula[]) => entityList.map( (entity) => this.generateFormulaWithElementList(entity, entity.formulaElement) ) )
    .then( (dtoList: FormulaDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `formula not found, id=${id}`;
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

    // * find formula
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto)
    .then( (entityList: Formula[]) => {
  
      // * validate
      if(entityList.length == 0){
        const msg = `formula not found, id=${id}`;
        this.logger.warn(`remove: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * delete: update field active
      const entity = entityList[0];
      entity.active = false;

      return this.save(entity)
      .then( (entity: Formula) => {
        
        const end = performance.now();
        this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';

      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'formula is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  private prepareEntity(entity: Formula, dto: FormulaDto): Promise<Formula> {
  
    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * calculate cost
      return this.calculateFormulaCost(dto)
      .then( (cost: number) => {

        // * prepare entity
        entity.company  = companyList[0];
        entity.name     = dto.name.toUpperCase();
        entity.cost     = dto.cost;
        entity.cost     = cost; // TODO: crear manual cost
  
        return entity;

      })
      
    })
    
  }

  findByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Formula[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by id or partial value
    const value = inputDto.search;
    if(value) {
      const whereById     = { id: value, active: true };
      const whereByValue  = { company: { id: companyId }, name: value, active: true };
      const where = isUUID(value) ? whereById : whereByValue;

      return this.formulaRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where,
        relations: {
          formulaElement: true
        }
      })
    }

    // * search by value list
    if(inputDto.searchList?.length > 0) {
      return this.formulaRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          company: { 
            id: companyId 
          },
          name: Raw( (fieldName) => inputDto.searchList.map(value => `${fieldName} LIKE '%${value.replace(' ', '%')}%'`).join(' OR ') ),
          // name: In(inputDto.searchList),
          active: true
        },
        relations: {
          formulaElement: true
        }
      })
    }

    // * search by id list
    if(inputDto.idList?.length > 0) {
      return this.formulaRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: {
          id: In(inputDto.idList),
          active: true
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
        active: true 
      },
      relations: {
        formulaElement: true
      }
    })
    
  }

  private save(entity: Formula): Promise<Formula> {
    const start = performance.now();

    const newEntity: Formula = this.formulaRepository.create(entity);

    return this.formulaRepository.save(newEntity)
    .then( (entity: Formula) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
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
    const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

    return this.elementService.findByParams({}, inputDto)
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
    let cost: number = formula.cost ? formula.cost : 0/*formula.manualCost*/; // TODO: crear manual cost

    if(formulaElementList.length > 0){
      formulaElementDtoList = formulaElementList.map( (formulaElement: FormulaElement) => new FormulaElementDto(formulaElement.element.id, formulaElement.qty, formulaElement.element.name, formulaElement.element.cost, formulaElement.element.unit) );
      
      // * calculate cost
      //cost = this.calculateElementsCost(formulaElementList); // formulaElementDtoList.reduce( (cost, formulaElementDto) => cost + (formulaElementDto.qty * formulaElementDto.cost), 0);
    } 

    // * generate formula dto
    const formulaDto = new FormulaDto(formula.company.id, formula.name, cost, formula.id, formulaElementDtoList);

    return formulaDto;
  }

  // private calculateElementsCost(list: FormulaElement[]): number{
  
  //   const cost = list.reduce( (acc, dto) => {
  //     acc += dto.qty * dto.element.cost;
  //     return acc;
  //   }, 0);

  //   return cost;
  // }

  private calculateFormulaCost(dto: FormulaDto): Promise<number>{

    // * find elements by id
    const elementIdList = dto.elementList.map( (item) => item.id );
    const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

    return this.elementService.findByParams({}, inputDto)
    .then( (entityList: Element[]) => {
      
      // * calculate cost
      const formulaElementList: FormulaElement[] = entityList.map( (item) => {
        const entity = new FormulaElement();
        entity.element = item;
        entity.qty;
        return entity;
      });

      const cost = formulaElementList.reduce( (acc, dto) => acc + (dto.qty * dto.element.cost), 0);
      return cost;
    })

  }

}
