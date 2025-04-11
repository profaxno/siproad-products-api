import { Brackets, In, InsertResult, Like, Raw, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ProductDto, ProductFormulaDto, ProductElementDto } from './dto/product.dto';
import { Product, ProductFormula, Formula, ProductElement, Element, Company, ProductType, FormulaElement } from './entities';

import { FormulaService } from './formula.service';
import { CompanyService } from './company.service';

import { ProcessEnum, SourceEnum } from 'src/data-transfer/enums';
import { MessageDto } from 'src/data-transfer/dto/message.dto';
import { DataReplicationService } from 'src/data-transfer/data-replication/data-replication.service';

import { AlreadyExistException, IsBeingUsedException } from '../common/exceptions/common.exception';
import { ProductTypeService } from './product-type.service';
import { JsonBasic } from 'src/data-transfer/interfaces/json-basic.interface';
import { ElementService } from './element.service';
import { ProductSearchInputDto } from './dto/product-search.dto';


@Injectable()
export class ProductService {

  private readonly logger = new Logger(ProductService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,
    
    @InjectRepository(Product, 'productsConn')
    private readonly productRepository: Repository<Product>,
    
    @InjectRepository(ProductElement, 'productsConn')
    private readonly productElementRepository: Repository<ProductElement>,

    // @InjectRepository(Element, 'productsConn')
    // private readonly elementRepository: Repository<Element>,

    @InjectRepository(ProductFormula, 'productsConn')
    private readonly productFormulaRepository: Repository<ProductFormula>,
    
    // @InjectRepository(Formula, 'productsConn')
    // private readonly formulaRepository: Repository<Formula>,

    private readonly companyService: CompanyService,
    private readonly elementService: ElementService,
    private readonly formulaService: FormulaService,
    private readonly productTypeService: ProductTypeService,
    private readonly replicationService: DataReplicationService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateBatch(dtoList: ProductDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processResultDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.update(dto)
      .then( () => {
        processResultDto.rowsOK++;
        processResultDto.detailsRowsOK.push(`(${i++}) name=${dto.name}, message=OK`);
      })
      .catch(error => {
        processResultDto.rowsKO++;
        processResultDto.detailsRowsKO.push(`(${i++}) name=${dto.name}, error=${error}`);
      })

    }
    
    const end = performance.now();
    this.logger.log(`updateBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processResultDto;
  }

  update(dto: ProductDto): Promise<ProductDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find product
    const inputDto: SearchInputDto = new SearchInputDto(dto.id);
      
    return this.findByParams({}, inputDto)
    .then( (entityList: Product[]) => {

      // * validate
      if(entityList.length == 0){
        const msg = `product not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * update
      const entity = entityList[0];

      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: Product) => this.save(entity) ) // * update
      .then( (entity: Product) => {

        return (entity.hasFormula ? this.updateProductFormula(entity, dto.formulaList) : this.updateProductElement(entity, dto.elementList)) // * create productElement
        .then( (productElementOrFormulaList: any) => (entity.hasFormula ? this.generateProductWithFormulaList(entity, productElementOrFormulaList) : this.generateProductWithElementList(entity, productElementOrFormulaList) ) ) // * generate product with productElement
        .then( (dto: ProductDto) => {

          // * replication data
          const messageDto = new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.PRODUCT_UPDATE, JSON.stringify(dto));
          this.replicationService.sendMessages([messageDto]);

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

  create(dto: ProductDto): Promise<ProductDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find product
    const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
    
    return this.findByParams({}, inputDto, dto.companyId)
    .then( (entityList: Product[]) => {

      // * validate
      if(entityList.length > 0){
        const msg = `product already exists, name=${dto.name}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }
      
      // * create
      const entity = new Product();
      
      return this.prepareEntity(entity, dto) // * prepare
      .then( (entity: Product) => this.save(entity) ) // * create
      .then( (entity: Product) => {

        return (entity.hasFormula ? this.updateProductFormula(entity, dto.formulaList) : this.updateProductElement(entity, dto.elementList)) // * create productElement
        .then( (productElementOrFormulaList: any) => (entity.hasFormula ? this.generateProductWithFormulaList(entity, productElementOrFormulaList) : this.generateProductWithElementList(entity, productElementOrFormulaList) ) ) // * generate product with productElement
        .then( (dto: ProductDto) => {

          // * replication data
          const messageDto = new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.PRODUCT_UPDATE, JSON.stringify(dto));
          this.replicationService.sendMessages([messageDto]);

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

  // find(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ProductDto[]> {
  //   const start = performance.now();

  //   return this.findByParams(paginationDto, inputDto, companyId)
  //   .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
  //   .then( (dtoList: ProductDto[]) => {
      
  //     if(dtoList.length == 0){
  //       const msg = `products not found`;
  //       this.logger.warn(`find: ${msg}`);
  //       throw new NotFoundException(msg);
  //     }

  //     const end = performance.now();
  //     this.logger.log(`find: executed, runtime=${(end - start) / 1000} seconds`);
  //     return dtoList;
  //   })
  //   .catch(error => {
  //     if(error instanceof NotFoundException)
  //       throw error;

  //     this.logger.error(`find: error`, error);
  //     throw error;
  //   })
 
  // }

  findOneById(id: string, companyId?: string): Promise<ProductDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(id);

    return this.findByParams({}, inputDto, companyId)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `product not found, id=${id}`;
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

  searchByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductSearchInputDto): Promise<ProductDto[]> {
    const start = performance.now();

    return this.searchEntitiesByValues(companyId, paginationDto, inputDto)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `products not found, inputDto=${JSON.stringify(inputDto)}`;
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

  // findByCategory(companyId: string, categoryId: string, paginationDto: SearchPaginationDto): Promise<ProductDto[]> {
  //   const start = performance.now();

  //   return this.findProductsByCategory(paginationDto, companyId, categoryId)
  //   .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
  //   .then( (dtoList: ProductDto[]) => {
      
  //     if(dtoList.length == 0){
  //       const msg = `products not found, categoryId=${categoryId}`;
  //       this.logger.warn(`findByCategory: ${msg}`);
  //       throw new NotFoundException(msg);
  //     }

  //     const end = performance.now();
  //     this.logger.log(`findByCategory: executed, runtime=${(end - start) / 1000} seconds`);
  //     return dtoList;
  //   })
  //   .catch(error => {
  //     if(error instanceof NotFoundException)
  //       throw error;

  //     this.logger.error(`findByCategory: error`, error);
  //     throw error;
  //   })
    
  // }

  remove(id: string): Promise<string> {
    this.logger.warn(`remove: starting process... id=${id}`);
    const start = performance.now();

    // * find product
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findByParams({}, inputDto)
    .then( (entityList: Product[]) => {
  
      // * validate
      if(entityList.length == 0){
        const msg = `product not found, id=${id}`;
        this.logger.warn(`remove: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new PfxHttpResponseDto(HttpStatus.NOT_FOUND, msg);
      }
      
      // * delete: update field active
      const entity = entityList[0];
      entity.active = false;

      return this.save(entity)
      .then( (entity: Product) => {

        // * replication data
        const jsonBasic: JsonBasic = { id: entity.id }
        const messageDto = new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.PRODUCT_DELETE, JSON.stringify(jsonBasic));
        this.replicationService.sendMessages([messageDto]);

        const end = performance.now();
        this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new PfxHttpResponseDto(HttpStatus.OK, 'delete OK');
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'product is being used';
        this.logger.warn(`remove: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new PfxHttpResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  findByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by id or partial value
    const value = inputDto.search;
    if(value) {
      const whereById     = { id: value, active: true };
      const whereByValue  = { company: { id: companyId }, name: value, active: true };
      const where = isUUID(value) ? whereById : whereByValue;

      return this.productRepository.find({
        take: limit,
        skip: (page - 1) * limit,
        where: where,
        relations: {
          productElement: true,
          productFormula: true
        }
      })
    }

    // * search by value list
    if(inputDto.searchList) {
      return this.productRepository.find({
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
          productElement: true,
          productFormula: true
        }
      })
    }

    // * search all
    return this.productRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: { 
        company: { 
          id: companyId 
        },
        active: true 
      },
      relations: {
        productElement: true,
        productFormula: true
      }
    })
    
  }

  private searchEntitiesByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductSearchInputDto): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    const query = this.productRepository.createQueryBuilder('a')
    .leftJoinAndSelect('a.company', 'company')
    .leftJoinAndSelect('a.productElement', 'productElement')
    .leftJoinAndSelect('a.productFormula', 'productFormula')
    .where('a.companyId = :companyId', { companyId })
    .andWhere('a.active = :active', { active: true });

    if(inputDto.nameCode) {
      const formatted = `%${inputDto.nameCode?.toLowerCase().replace(' ', '%')}%`;
      query.andWhere(
        new Brackets(qb => {
          qb.where('a.name LIKE :name').orWhere('a.code LIKE :code');
        }),
        {
          name: formatted,
          code: formatted,
        }
      );

      // const formatted = `%${inputDto.customerNameIdDoc.replace(' ', '%')}%`;
      // query.andWhere('a.customerName LIKE :customerName OR a.customerIdDoc LIKE :customerIdDoc', { customerName: formatted, customerIdDoc: formatted });
    }

    if(inputDto.productTypeId) {
      query.andWhere('a.productTypeId = :productTypeId', { productTypeId: inputDto.productTypeId });
    }

    return query
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  }
  
  synchronize(companyId: string, paginationDto: SearchPaginationDto): Promise<string> {
    this.logger.warn(`synchronize: starting process... companyId=${companyId}, paginationDto=${JSON.stringify(paginationDto)}`);

    return this.findAll(paginationDto, companyId)
    .then( (entityList: Product[]) => {
      
      if(entityList.length == 0){
        const msg = 'executed';
        this.logger.log(`synchronize: ${msg}`);
        return msg;
      }

      const messageDtoList: MessageDto[] = entityList.map( value => {
        const process = value.active ? ProcessEnum.PRODUCT_UPDATE : ProcessEnum.PRODUCT_DELETE;
        const dto = new ProductDto(value.company.id, value.name, value.cost, value.price, value.hasFormula, value.active, value.id, value.code, value.productType?.id, value.description, value.imagenUrl);
        return new MessageDto(SourceEnum.API_PRODUCTS, process, JSON.stringify(dto));
      })
            
      return this.replicationService.sendMessages(messageDtoList)
      .then( () => {
        paginationDto.page++;
        return this.synchronize(companyId, paginationDto);
      })
      
    })
    .catch( error => {
      const msg = `not executed (unexpected error)`;
      this.logger.error(`synchronize: ${msg}, paginationDto=${JSON.stringify(paginationDto)}`, error);
      return msg;
    })

  }

  private prepareEntity(entity: Product, dto: ProductDto): Promise<Product> {

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      // * find product type
      const inputDto: SearchInputDto = new SearchInputDto(dto.productTypeId);

      return ( dto.productTypeId ? this.productTypeService.findByParams({}, inputDto, dto.companyId) : Promise.resolve([]) )
      .then( (productTypeList: ProductType[]) => {
        
        // * calculate cost
        return this.calculateProductCost(dto)
        .then( (cost: number) => {

          // * prepare entity
          entity.company      = companyList[0];
          entity.name         = dto.name.toUpperCase();
          entity.code         = dto.code ? dto.code.toUpperCase() : null;
          entity.description  = dto.description ? dto.description.toUpperCase() : null;
          entity.cost         = cost;
          entity.price        = dto.price;
          entity.hasFormula   = dto.hasFormula;
          entity.active       = dto.active;
          entity.productType  = productTypeList.length > 0 ? productTypeList[0] : null;

          return entity;
        })

      })
      .catch( error => {
        this.logger.error(`prepareEntity: error`, error);
        throw error;
      })

    })
    
  }

  // private prepareEntity(entity: Product, dto: ProductDto): Promise<Product> {

  //   // * find company
  //   const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
  //   return this.companyService.findByParams({}, inputDto)
  //   .then( async(companyList: Company[]) => {

  //     if(companyList.length == 0){
  //       const msg = `company not found, id=${dto.companyId}`;
  //       this.logger.warn(`create: not executed (${msg})`);
  //       throw new NotFoundException(msg);
  //     }

  //     // * find product type
  //     let productType: ProductType = undefined;
  //     if(dto.productTypeId){
  //       const inputDto : SearchInputDto = new SearchInputDto(dto.productTypeId);
  //       const productTypeList : ProductType[] = await this.productTypeService.findByParams({}, inputDto, dto.companyId);
  //       productType = productTypeList.length > 0 ? productTypeList[0] : undefined;
  //     }

  //     // * calculate cost
  //     return this.calculateProductCost(dto)
  //     .then( (cost: number) => {

  //       // * prepare entity
  //       entity.company      = companyList[0];
  //       entity.name         = dto.name.toUpperCase();
  //       entity.description  = dto.description?.toUpperCase();
  //       entity.cost         = cost;
  //       entity.price        = dto.price;
  //       entity.hasFormula   = dto.hasFormula;
  //       entity.productType  = productType

  //       return entity;
  //     })

  //   })
    
  // }

  private save(entity: Product): Promise<Product> {
    const start = performance.now();

    const newEntity: Product = this.productRepository.create(entity);

    return this.productRepository.save(newEntity)
    .then( (entity: Product) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }

  private findAll(paginationDto: SearchPaginationDto, companyId: string): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search all
    return this.productRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: {
        company: { 
          id: companyId 
        }
      },
      relations: {
        productType   : true,
        productElement: true,
        productFormula: true
      }
      
    })
    
  }

  private findProductsByCategory(paginationDto: SearchPaginationDto, companyId: string, categoryId: string): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;
    
    return this.productRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: {
        company: { 
          id: companyId 
        },
        productType: {
          id: categoryId
        },
        active: true,
      },
      relations: {
        productElement: true,
        productFormula: true
      }
    })
    
  }

  private generateProductWithAssociationList(product: Product, productElementList?: ProductElement[], productFormulaList?: ProductFormula[]): ProductDto {
    
    if(product.hasFormula){
      return this.generateProductWithFormulaList(product, productFormulaList);
    } else {
      return this.generateProductWithElementList(product, productElementList);
    }

  }

  // * product with element
  private updateProductElement(product: Product, productElementDtoList: ProductElementDto[] = []): Promise<ProductElement[] | ProductFormula[]> {
    this.logger.log(`updateProductElement: starting process... product=${JSON.stringify(product)}, productElementDtoList=${JSON.stringify(productElementDtoList)}`);
    const start = performance.now();

    if(productElementDtoList.length == 0){
      this.logger.warn(`updateProductElement: not executed (product element list empty)`);
      return Promise.resolve([]);
    }

    // * find elements by id
    const elementIdList = productElementDtoList.map( (item) => item.id );
    const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

    return this.elementService.findByParams({}, inputDto)
    .then( (elementList: Element[]) => {

      // * validate
      if(elementList.length !== elementIdList.length){
        const elementIdNotFoundList: string[] = elementIdList.filter( (id) => !elementList.find( (element) => element.id == id) );
        const msg = `elements not found, idList=${JSON.stringify(elementIdNotFoundList)}`;
        throw new NotFoundException(msg); 
      }

      // * create productElement
      return this.productElementRepository.findBy( { product } ) // * find productElement
      .then( (productElementList: ProductElement[]) => this.productElementRepository.remove(productElementList)) // * remove productElements
      .then( () => {
        
        // * generate product element list
        const productElementList: ProductElement[] = elementList.map( (element: Element) => {
          const productElement = new ProductElement();
          productElement.product = product;
          productElement.element = element;
          productElement.qty = productElementDtoList.find( (value) => value.id == element.id).qty;
          return productElement;
        })
  
        // * bulk insert
        return this.bulkInsertProductElements(productElementList)
        .then( (productElementList: ProductElement[]) => {
          const end = performance.now();
          this.logger.log(`updateProductElement: OK, runtime=${(end - start) / 1000} seconds`);
          return productElementList;
        })

      })

    })

  }

  private bulkInsertProductElements(productElementList: ProductElement[]): Promise<ProductElement[]> {
    const start = performance.now();
    this.logger.log(`bulkInsertProductElements: starting process... listSize=${productElementList.length}`);

    const newProductElementList: ProductElement[] = productElementList.map( (value) => this.productElementRepository.create(value));
    
    return this.productElementRepository.manager.transaction( async(transactionalEntityManager) => {
      
      return transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(ProductElement)
        .values(newProductElementList)
        .execute()
        .then( (insertResult: InsertResult) => {
          const end = performance.now();
          this.logger.log(`bulkInsertProductElements: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
          return newProductElementList;
        })
    })
  }
  
  private generateProductWithElementList(product: Product, productElementList: ProductElement[]): ProductDto {

    let productElementDtoList: ProductElementDto[] = [];
    let cost: number = product.cost ? product.cost : 0 /*product.manualCost*/; // TODO: crear manual cost

    if(productElementList.length > 0){
      productElementDtoList = productElementList.map( (productElement: ProductElement) => new ProductElementDto(productElement.element.id, productElement.qty, productElement.element.name, productElement.element.cost, productElement.element.unit) );
      
      // // * calculate cost
      // cost = this.calculateElementsCost(productElementList); //productElementDtoList.reduce( (acc, dto) => acc + (dto.qty * dto.cost), 0);
    }

    // * generate product dto
    const productDto = new ProductDto(product.company.id, product.name, product.cost, product.price, product.hasFormula, product.active, product.id, product.code, product.productType?.id, product.description, product.imagenUrl/*, product.active*/, productElementDtoList, []);

    return productDto;
  }

  // private calculateElementsCost(list: FormulaElement[] | ProductElement[]): number{

  //   const cost = list.reduce( (acc, dto) => {
  //     acc += dto.qty * dto.element.cost;
  //     return acc;
  //   }, 0);

  //   return cost;
  // }

  // * product with formula
  private updateProductFormula(product: Product, productFormulaDtoList: ProductFormulaDto[] = []): Promise<ProductFormula[] | ProductElement[]> {
    this.logger.log(`updateProductFormula: starting process... product=${JSON.stringify(product)}, productFormulaDtoList=${JSON.stringify(productFormulaDtoList)}`);
    const start = performance.now();

    if(productFormulaDtoList.length == 0){
      this.logger.warn(`updateProductFormula: not executed (product formula list empty)`);
      return Promise.resolve([]);
    }

    // * find formulas by id
    const formulaIdList = productFormulaDtoList.map( (item) => item.id );
    const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, formulaIdList);

    return this.formulaService.findByParams({}, inputDto)
    .then( (formulaList: Formula[]) => {

      // * validate
      if(formulaList.length !== formulaIdList.length){
        const formulaIdNotFoundList: string[] = formulaIdList.filter( (id) => !formulaList.find( (formula) => formula.id == id) );
        const msg = `formulas not found, idList=${JSON.stringify(formulaIdNotFoundList)}`;
        throw new NotFoundException(msg); 
      }

      // * create productFormula
      return this.productFormulaRepository.findBy( { product } ) // * find productFormula
      .then( (productFormulaList: ProductFormula[]) => this.productFormulaRepository.remove(productFormulaList)) // * remove productFormulas
      .then( () => {
        
        // * generate product formula list
        const productFormulaList: ProductFormula[] = formulaList.map( (formula: Formula) => {
          const productFormula = new ProductFormula();
          productFormula.product = product;
          productFormula.formula = formula;
          productFormula.qty = productFormulaDtoList.find( (formulaDto) => formulaDto.id == formula.id).qty;
          return productFormula;
        })
  
        // * bulk insert
        return this.bulkInsertProductFormulas(productFormulaList)
        .then( (productFormulaList: ProductFormula[]) => {
          const end = performance.now();
          this.logger.log(`updateProductFormula: OK, runtime=${(end - start) / 1000} seconds`);
          return productFormulaList;
        })

      })

    })

  }

  private bulkInsertProductFormulas(productFormulaList: ProductFormula[]): Promise<ProductFormula[]> {
    const start = performance.now();
    this.logger.log(`bulkInsertProductFormulas: starting process... listSize=${productFormulaList.length}`);

    const newProductFormulaList: ProductFormula[] = productFormulaList.map( (value) => this.productFormulaRepository.create(value));
    
    return this.productFormulaRepository.manager.transaction( async(transactionalEntityManager) => {
      
      return transactionalEntityManager
        .createQueryBuilder()
        .insert()
        .into(ProductFormula)
        .values(newProductFormulaList)
        .execute()
        .then( (insertResult: InsertResult) => {
          const end = performance.now();
          this.logger.log(`bulkInsertProductFormulas: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
          return newProductFormulaList;
        })
    })
  }

  private generateProductWithFormulaList(product: Product, productFormulaList: ProductFormula[]): ProductDto {
    
    let productFormulaDtoList: ProductFormulaDto[] = [];
    let cost: number = product.cost;

    if(productFormulaList.length > 0){

      productFormulaDtoList = productFormulaList.map( (productFormula: ProductFormula) => {
        const formula = productFormula.formula;
        const formulaDto = this.formulaService.generateFormulaWithElementList(formula, formula.formulaElement);
        const productFormulaCost = productFormula.qty * formulaDto.cost;
        return new ProductFormulaDto(formulaDto.id, productFormula.qty, formulaDto.name, productFormulaCost, formulaDto.elementList);
      });

    }

    // if(productFormulaList.length > 0){

    //   productFormulaDtoList = productFormulaList.map( (productFormula: ProductFormula) => {
    //     const formulaDto = this.formulaService.generateFormulaWithElementList(productFormula.formula, productFormula.formula.formulaElement);
        
    //     // * update quantity of each ingredient
    //     formulaDto.elementList = formulaDto.elementList.map( (elementDto) => {
    //       elementDto.qty = elementDto.qty * productFormula.qty;
    //       return elementDto;
    //     } );

    //     // * update formula cost
    //     const formulaCost = formulaDto.cost * productFormula.qty;
    //     return new ProductFormulaDto(formulaDto.id, productFormula.qty, formulaDto.name, formulaCost, formulaDto.elementList);
    //   });
      
      
    //   // * calculate cost
    //   cost = productFormulaDtoList.reduce( (acc, dto) => acc + (dto.cost), 0);
    // }

    // * generate product dto
    
    const productDto = new ProductDto(product.company.id, product.name, product.cost, product.price, product.hasFormula, product.active, product.id, product.code, product.productType?.id, product.description, product.imagenUrl/*, product.active*/, [], productFormulaDtoList);

    return productDto;
  }

  // private calculateFormulasCost(productFormulaList: ProductFormula[]): number{

  //   const cost = productFormulaList.reduce( (acc, dto) => {
  //     const formulaElementList = dto.formula.formulaElement;
      
  //     acc += dto.qty * this.calculateElementsCost(formulaElementList);
  //     return acc;
  //   }, 0);

  //   return cost;
  // }

  private calculateProductCost(dto: ProductDto): Promise<number>{

    if(dto.hasFormula){

      if(dto.formulaList.length == 0){
        this.logger.warn(`calculateProductCost: not executed (formula list empty)`);
        return Promise.resolve(dto.cost);
      }

      // * find formula by id
      const formulaIdList = dto.formulaList.map( (item) => item.id );
      const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, formulaIdList);

      return this.formulaService.findByParams({}, inputDto)
      .then( (entityList: Formula[]) => {
        
        // * calculate cost
        const productFormulaList: ProductFormula[] = entityList.map( (item) => {
          const productFormulaDto = dto.formulaList.find( (value) => value.id == item.id);

          const entity = new ProductFormula();
          entity.formula = item;
          entity.qty = productFormulaDto.qty;
          return entity;
        });

        const cost = productFormulaList.reduce( (acc, dto) => acc + (dto.qty * dto.formula.cost), 0);
        return cost;
      })

    } else {

      if(dto.elementList.length == 0){
        this.logger.warn(`calculateProductCost: not executed (element list empty)`);
        return Promise.resolve(dto.cost);
      }

      // * find elements by id
      const elementIdList = dto.elementList.map( (item) => item.id );
      const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

      return this.elementService.findByParams({}, inputDto)
      .then( (entityList: Element[]) => {
        
        // * calculate cost
        const productElementList: ProductElement[] = entityList.map( (item) => {
          const productElementDto = dto.elementList.find( (value) => value.id == item.id);

          const entity = new ProductElement();
          entity.element = item;
          entity.qty = productElementDto.qty;
          return entity;
        });

        const cost = productElementList.reduce( (acc, dto) => acc + (dto.qty * dto.element.cost), 0);
        return cost;
      })

    }
    
  }

}
