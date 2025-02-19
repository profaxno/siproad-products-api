import { In, InsertResult, Like, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';

import { ProductDto, ProductElementDto, ProductFormulaDto } from './dto/product.dto';
import { Product } from './entities/product.entity';
import { ProductElement } from './entities/product-element.entity';

import { Element } from './entities/element.entity';

import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';
import { ProductFormula } from './entities/product-formula.entity';

import { FormulaService } from './formula.service';
import { Formula } from './entities/formula.entity';
import { AlreadyExistException, IsBeingUsedException } from './exceptions/products.exception';
import { MessageDto, DataReplicationDto } from 'src/data-replication/dto/data-replication.dto';
import { ProcessEnum, SourceEnum } from 'src/data-replication/enum';
import { DataReplicationService } from 'src/data-replication/data-replication.service';

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
    private readonly formulaService: FormulaService,
    private readonly replicationService: DataReplicationService
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateProductBatch(dtoList: ProductDto[]): Promise<ProcessSummaryDto>{
    this.logger.warn(`updateProductBatch: starting process... listSize=${dtoList.length}`);
    const start = performance.now();
    
    let processResultDto: ProcessSummaryDto = new ProcessSummaryDto(dtoList.length);
    let i = 0;
    for (const dto of dtoList) {
      
      await this.updateProduct(dto)
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
    this.logger.log(`updateProductBatch: executed, runtime=${(end - start) / 1000} seconds`);
    return processResultDto;
  }

  updateProduct(dto: ProductDto): Promise<ProductDto> {
    if(!dto.id)
      return this.createProduct(dto); // * create
    
    this.logger.warn(`updateProduct: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`updateProduct: not executed (${msg})`);
        throw new NotFoundException(msg);
      }

      const company = companyList[0];

      // * find product
      const inputDto: SearchInputDto = new SearchInputDto(dto.id);
        
      return this.findProductsByParams({}, inputDto)
      .then( (entityList: Product[]) => {

        // * validate
        if(entityList.length == 0){
          const msg = `product not found, id=${dto.id}`;
          this.logger.warn(`updateProduct: not executed (${msg})`);
          throw new NotFoundException(msg);
        }

        let entity = entityList[0];

        // * update
        entity.company = company;
        entity.name = dto.name.toUpperCase();
        entity.description = dto.description.toUpperCase();
        entity.cost = dto.cost;
        entity.price = dto.price;
        entity.hasFormula = dto.hasFormula;

        return this.saveProduct(entity) // * update product
        .then( (entity: Product) => {

          return (entity.hasFormula ? this.updateProductFormula(entity, dto.formulaList) : this.updateProductElement(entity, dto.elementList)) // * create productElement
          .then( (productElementOrFormulaList: any) => (entity.hasFormula ? this.generateProductWithFormulaList(entity, productElementOrFormulaList) : this.generateProductWithElementList(entity, productElementOrFormulaList) ) ) // * generate product with productElement
          .then( (dto: ProductDto) => {

            // * replication data
            const dataReplicationDto: DataReplicationDto = new DataReplicationDto([new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.ORDERS_PRODUCT_UPDATE, JSON.stringify(dto))]);
            this.replicationService.sendMessages(dataReplicationDto);

            const end = performance.now();
            this.logger.log(`updateProduct: executed, runtime=${(end - start) / 1000} seconds`);
            return dto;
            
          })
        
        })
        
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`updateProduct: error`, error);
      throw error;
    })

  }

  createProduct(dto: ProductDto): Promise<ProductDto> {
    this.logger.warn(`createProduct: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    // * find company
    const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);

    return this.companyService.findCompaniesByParams({}, inputDto)
    .then( (companyList: Company[]) => {

      if(companyList.length == 0){
        const msg = `company not found, id=${dto.companyId}`;
        this.logger.warn(`createProduct: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new productsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const company = companyList[0];

      // * find product
      const inputDto: SearchInputDto = new SearchInputDto(undefined, [dto.name]);
      
      return this.findProductsByParams({}, inputDto, company.id)
      .then( (entityList: Product[]) => {
  
        // * validate
        if(entityList.length > 0){
          const msg = `product already exists, name=${dto.name}`;
          this.logger.warn(`createProduct: not executed (${msg})`);
          throw new AlreadyExistException(msg);
          // return new productsResponseDto(HttpStatus.BAD_REQUEST, msg);
        }
        
        // * create
        let entity = new Product();
        entity.company = company;
        entity.name = dto.name.toUpperCase();
        entity.description = dto.description.toUpperCase();
        entity.cost = dto.cost;
        entity.price = dto.price;
        entity.hasFormula = dto.hasFormula;
  
        return this.saveProduct(entity) // * create product
        .then( (entity: Product) => {

          return (entity.hasFormula ? this.updateProductFormula(entity, dto.formulaList) : this.updateProductElement(entity, dto.elementList)) // * create productElement
          .then( (productElementOrFormulaList: any) => (entity.hasFormula ? this.generateProductWithFormulaList(entity, productElementOrFormulaList) : this.generateProductWithElementList(entity, productElementOrFormulaList) ) ) // * generate product with productElement
          .then( (dto: ProductDto) => {
  
            // * replication data
            const dataReplicationDto: DataReplicationDto = new DataReplicationDto([new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.ORDERS_PRODUCT_UPDATE, JSON.stringify(dto))]);
            this.replicationService.sendMessages(dataReplicationDto);

            const end = performance.now();
            this.logger.log(`createProduct: created OK, runtime=${(end - start) / 1000} seconds`);
            return dto;
            //return new productsResponseDto(HttpStatus.CREATED, 'created OK', [dto]);
          })
  
        })
  
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`createProduct: error`, error);
      throw error;
    })
    
  }

  findProducts(companyId: string, paginationDto: SearchPaginationDto, inputDto: SearchInputDto): Promise<ProductDto[]> {
    const start = performance.now();

    return this.findProductsByParams(paginationDto, inputDto, companyId)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `products not found`;
        this.logger.warn(`findProducts: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findProducts: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findProducts: error`, error);
      throw error;
    })
 
  }

  findOneProductByValue(companyId: string, value: string): Promise<ProductDto[]> {
    const start = performance.now();

    const inputDto: SearchInputDto = new SearchInputDto(value);

    return this.findProductsByParams({}, inputDto, companyId)
    .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithAssociationList(entity, entity.productElement, entity.productFormula) ) )
    .then( (dtoList: ProductDto[]) => {
      
      if(dtoList.length == 0){
        const msg = `product not found, value=${value}`;
        this.logger.warn(`findOneProductByValue: ${msg}`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }

      const end = performance.now();
      this.logger.log(`findOneProductByValue: executed, runtime=${(end - start) / 1000} seconds`);
      return dtoList;
      //return new ProductsResponseDto(HttpStatus.OK, 'OK', dtoList);
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      this.logger.error(`findOneProductByValue: error`, error);
      throw error;
    })
    
  }

  removeProduct(id: string): Promise<string> {
    this.logger.warn(`removeProduct: starting process... id=${id}`);
    const start = performance.now();

    // * find product
    const inputDto: SearchInputDto = new SearchInputDto(id);
    
    return this.findProductsByParams({}, inputDto)
    .then( (entityList: Product[]) => {
  
      // * validate
      if(entityList.length == 0){
        const msg = `product not found, id=${id}`;
        this.logger.warn(`removeProduct: not executed (${msg})`);
        throw new NotFoundException(msg);
        //return new ProductsResponseDto(HttpStatus.NOT_FOUND, msg);
      }
      
      // * delete
      return this.productRepository.delete(id) // * delete product and productElement on cascade
      .then( () => {

        // * replication data
        const entity = entityList[0];
        const dto = new ProductDto(entity.company.id, entity.name, entity.cost, entity.price, entity.hasFormula, [], [], entity.id); // * map to dto
        const dataReplicationDto: DataReplicationDto = new DataReplicationDto([new MessageDto(SourceEnum.API_PRODUCTS, ProcessEnum.ORDERS_PRODUCT_DELETE, JSON.stringify(dto))]);
        this.replicationService.sendMessages(dataReplicationDto);

        const end = performance.now();
        this.logger.log(`removeProduct: OK, runtime=${(end - start) / 1000} seconds`);
        return 'deleted';
        //return new ProductsResponseDto(HttpStatus.OK, 'delete OK');
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'product is being used';
        this.logger.warn(`removeProduct: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
        //return new ProductsResponseDto(HttpStatus.BAD_REQUEST, 'product is being used');
      }

      this.logger.error('removeProduct: error', error);
      throw error;
    })

  }

  findProductsByParams(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    // * search by partial name
    if(inputDto.search) {
      const whereByName = { company: { id: companyId }, name: Like(`%${inputDto.search}%`), active: true };
      const whereById   = { id: inputDto.search, active: true };
      const where = isUUID(inputDto.search) ? whereById : whereByName;

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

    // * search by names
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

  saveProduct(entity: Product): Promise<Product> {
    const start = performance.now();

    const newEntity: Product = this.productRepository.create(entity);

    return this.productRepository.save(newEntity)
    .then( (entity: Product) => {
      const end = performance.now();
      this.logger.log(`saveProduct: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
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

}
