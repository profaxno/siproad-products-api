import { In, InsertResult, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ProductDto, ProductFormulaDto, ProductElementDto } from './dto/product.dto';
import { Product, ProductFormula, Formula, ProductElement, Element, Company, ProductType } from './entities';

import { FormulaService } from './formula.service';
import { CompanyService } from './company.service';

import { ProcessEnum, SourceEnum } from 'src/data-replication/enum';
import { MessageDto, DataReplicationDto } from 'src/data-replication/dto/data-replication.dto';
import { DataReplicationService } from 'src/data-replication/data-replication.service';

import { AlreadyExistException, IsBeingUsedException } from '../common/exceptions/common.exception';
import { ProductTypeService } from './product-type.service';

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

    @InjectRepository(Element, 'productsConn')
    private readonly elementRepository: Repository<Element>,

    @InjectRepository(ProductFormula, 'productsConn')
    private readonly productFormulaRepository: Repository<ProductFormula>,
    
    @InjectRepository(Formula, 'productsConn')
    private readonly formulaRepository: Repository<Formula>,

    private readonly companyService: CompanyService,
    private readonly productTypeService: ProductTypeService,
    private readonly formulaService: FormulaService,
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
          const dataReplicationDto: DataReplicationDto = new DataReplicationDto([messageDto]);
          this.replicationService.sendMessages(dataReplicationDto);

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
          const dataReplicationDto: DataReplicationDto = new DataReplicationDto([messageDto]);
          this.replicationService.sendMessages(dataReplicationDto);

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

  find(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ProductDto[]> {
    const start = performance.now();

    return this.findByParams(paginationDto, inputDto, companyId)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `products not found`;
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

  findByCategory(companyId: string, categoryId: string, paginationDto: SearchPaginationDto): Promise<ProductDto[]> {
    const start = performance.now();

    return this.findProductsByCategory(paginationDto, companyId, categoryId)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `products not found, categoryId=${categoryId}`;
        this.logger.warn(`findByCategory: ${msg}`);
        throw new NotFoundException(msg);
      }

      const end = performance.now();
      this.logger.log(`findByCategory: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findByCategory: error`, error);
      throw error;
    })
    
  }

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
        //return new ResponseDto(HttpStatus.NOT_FOUND, msg);
      }
      
      // * delete
      return this.productRepository.delete(id) // * delete product and productElement on cascade
      .then( () => {

        // * replication data
        const entity = entityList[0];
        const dto = new ProductDto(entity.company.id, entity.name, entity.cost, entity.price, entity.hasFormula, [], [], entity.id); // * map to dto
        const messageDto = new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.PRODUCT_DELETE, JSON.stringify(dto));
        const dataReplicationDto: DataReplicationDto = new DataReplicationDto([messageDto]);
        this.replicationService.sendMessages(dataReplicationDto);

        const end = performance.now();
        this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new ResponseDto(HttpStatus.OK, 'delete OK');
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'product is being used';
        this.logger.warn(`remove: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new ResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
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
      const whereById   = { id: value, active: true };
      const whereByName = { company: { id: companyId }, name: Like(`%${value}%`), active: true };
      const where       = isUUID(value) ? whereById : whereByName;

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
          name: In(inputDto.searchList),
          active: true,
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

  synchronize(companyId: string, paginationDto: SearchPaginationDto): Promise<string> {
    this.logger.warn(`synchronize: processing paginationDto=${JSON.stringify(paginationDto)}`);

    return this.findAllProducts(paginationDto, companyId)
    .then( (productList: Product[]) => {
      
      if(productList.length == 0){
        const msg = `synchronization executed`;
        this.logger.log(`synchronize: ${msg}`);
        return msg;
      }

      const productDtoList = productList.map( value => this.generateProductWithAssociationList(value, value.productElement, value.productFormula) );
      const messageDtoList: MessageDto[] = productDtoList.map( (value: ProductDto) => new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.PRODUCT_UPDATE, JSON.stringify(value)) );
      const dataReplicationDto: DataReplicationDto = new DataReplicationDto(messageDtoList);
            
      return this.replicationService.sendMessages(dataReplicationDto)
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

      return this.productTypeService.findByParams({}, inputDto, dto.companyId)
      .then( (productTypeList: ProductType[]) => {
        
        // TODO: cambiar todos los servicios que utilizan compañia para traer la consulta aqui
        entity.company      = companyList[0];
        entity.name         = dto.name.toUpperCase();
        entity.description  = dto.description.toUpperCase();
        entity.cost         = dto.cost;
        entity.price        = dto.price;
        entity.hasFormula   = dto.hasFormula;
        entity.productType  = productTypeList.length > 0 ? productTypeList[0] : undefined;

        return entity;
      })

    })
    
  }

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

  private updateProductElement(product: Product, productElementDtoList: ProductElementDto[] = []): Promise<ProductElement[] | ProductFormula[]> {
    this.logger.log(`updateProductElement: starting process... product=${JSON.stringify(product)}, productElementDtoList=${JSON.stringify(productElementDtoList)}`);
    const start = performance.now();

    if(productElementDtoList.length == 0){
      this.logger.warn(`updateProductElement: not executed (product element list empty)`);
      return Promise.resolve([]);
    }

    // * find elements by id
    const elementIdList = productElementDtoList.map( (item) => item.id );

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

      // * create productElement
      return this.productElementRepository.findBy( { product } ) // * find productElement
      .then( (productElementList: ProductElement[]) => this.productElementRepository.remove(productElementList)) // * remove productElements
      .then( () => {
        
        // * generate product element list
        const productElementList: ProductElement[] = elementList.map( (element: Element) => {
          const productElement = new ProductElement();
          productElement.product = product;
          productElement.element = element;
          productElement.qty = productElementDtoList.find( (elementDto) => elementDto.id == element.id).qty;
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
  
  private updateProductFormula(product: Product, productFormulaDtoList: ProductFormulaDto[] = []): Promise<ProductFormula[] | ProductElement[]> {
    this.logger.log(`updateProductFormula: starting process... product=${JSON.stringify(product)}, productFormulaDtoList=${JSON.stringify(productFormulaDtoList)}`);
    const start = performance.now();

    if(productFormulaDtoList.length == 0){
      this.logger.warn(`updateProductFormula: not executed (product formula list empty)`);
      return Promise.resolve([]);
    }

    // * find formulas by id
    const formulaIdList = productFormulaDtoList.map( (item) => item.id );

    return this.formulaRepository.findBy({ // TODO: Posiblemente aca deberia utilizarse el servicio y no el repositorio
      id: In(formulaIdList),
    })
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

  private generateProductWithAssociationList(product: Product, productElementList?: ProductElement[], productFormulaList?: ProductFormula[]): ProductDto {
    
    if(product.hasFormula){
      return this.generateProductWithFormulaList(product, productFormulaList);
    } else {
      return this.generateProductWithElementList(product, productElementList);
    }

  }

  private generateProductWithElementList(product: Product, productElementList: ProductElement[]): ProductDto {

    let productElementDtoList: ProductElementDto[] = [];
    let cost: number = product.cost;

    if(productElementList.length > 0){
      productElementDtoList = productElementList.map( (productElement: ProductElement) => new ProductElementDto(productElement.element.id, productElement.qty, productElement.element.name, productElement.element.cost, productElement.element.unit) );
      
      // * calculate cost
      cost = productElementDtoList.reduce( (cost, productElementDto) => cost + (productElementDto.qty * productElementDto.cost), 0);
    } 

    // * generate product dto
    const productDto = new ProductDto(product.company.id, product.name, cost, product.price, product.hasFormula, productElementDtoList, [], product.id, product.description);

    return productDto;
  }

  private generateProductWithFormulaList(product: Product, productFormulaList: ProductFormula[]): ProductDto {
    
    let productFormulaDtoList: ProductFormulaDto[] = [];
    let cost: number = product.cost;

    if(productFormulaList.length > 0){

      productFormulaDtoList = productFormulaList.map( (productFormula: ProductFormula) => {
        const formulaDto = this.formulaService.generateFormulaWithElementList(productFormula.formula, productFormula.formula.formulaElement);
        
        // * update quantity of each ingredient
        formulaDto.elementList = formulaDto.elementList.map( (elementDto) => {
          elementDto.qty = elementDto.qty * productFormula.qty;
          return elementDto;
        } );

        // * update formula cost
        const formulaCost = formulaDto.cost * productFormula.qty;
        return new ProductFormulaDto(formulaDto.id, productFormula.qty, formulaDto.name, formulaCost, formulaDto.elementList);
      });
      
      // * calculate cost
      cost = productFormulaDtoList.reduce( (cost, productFormulaDto) => cost + (productFormulaDto.cost), 0);
    }

    // * generate product dto
    const productDto = new ProductDto(product.company.id, product.name, cost, product.price, product.hasFormula, [], productFormulaDtoList, product.id, product.description);

    return productDto;
  }

  private findAllProducts(paginationDto: SearchPaginationDto, companyId: string): Promise<Product[]> {
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

}
