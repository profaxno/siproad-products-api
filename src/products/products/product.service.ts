import { Brackets, DataSource, EntityManager, In, InsertResult, Like, Raw, Repository } from 'typeorm';
import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';

import { ProductDto, ProductSearchInputDto, ProductElementDto, MovementDto } from './dto';
import { Product, ProductElement, ProductCategory, ProductUnit } from './entities';
import { ProductTypeEnum } from './enums';

import { Company } from '../companies/entities/company.entity';

import { AlreadyExistException, IsBeingUsedException } from '../../common/exceptions/common.exception';
import { ProductSearchInputQueryDto } from './dto/product-search-input-query.dto';

@Injectable()
export class ProductService {

  private readonly logger = new Logger(ProductService.name);

  private dbDefaultLimit = 1000;

  constructor(
    private readonly ConfigService: ConfigService,
    
    @InjectDataSource('productsConn')
    private readonly dataSource: DataSource,

    @InjectRepository(Product, 'productsConn')
    private readonly productRepository: Repository<Product>,
    
    @InjectRepository(ProductElement, 'productsConn')
    private readonly productElementRepository: Repository<ProductElement>
    
  ){
    this.dbDefaultLimit = this.ConfigService.get("dbDefaultLimit");
  }

  async updateBatch(dtoList: ProductDto[]): Promise<ProcessSummaryDto>{
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

  update(dto: ProductDto): Promise<ProductDto> {
    if(!dto.id)
      return this.create(dto); // * create
    
    this.logger.warn(`update: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.productRepository.findOne({
      where: { id: dto.id },
    })
    .then( (entity: Product) => {

      // * validate
      if(!entity){
        const msg = `entity not found, id=${dto.id}`;
        this.logger.warn(`update: not executed (${msg})`);
        throw new NotFoundException(msg);
      }
      
      return this.dataSource.transaction( (manager: EntityManager) => {

        // * get repositories
        const productRepository : Repository<Product> = manager.getRepository(Product);
        const productElementRepository: Repository<ProductElement> = manager.getRepository(ProductElement);

        return this.prepareEntity(entity, dto) // * prepare
        .then( (entity: Product) => this.save(entity, productRepository) ) // * save
        .then( (entity: Product) => {
          return this.updateProductElement(entity, dto.elementList, productElementRepository) // * create/update associated entity
          .then( (productElement: ProductElement[]) => this.generateProductWithElementList(entity, productElement, 0) ) // * generate dto
        })

      })
      .then( (dto: ProductDto) => {
        const end = performance.now();
        this.logger.log(`update: created OK, runtime=${(end - start) / 1000} seconds`);
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

  create(dto: ProductDto): Promise<ProductDto> {
    this.logger.warn(`create: starting process... dto=${JSON.stringify(dto)}`);
    const start = performance.now();

    return this.productRepository.findOne({
      where: { name: dto.name, company: { id: dto.companyId } },
    })
    .then( (entity: Product) => {

      // * validate
      if(entity){
        const msg = `name already exists, name=${dto.name}`;
        this.logger.warn(`create: not executed (${msg})`);
        throw new AlreadyExistException(msg);
      }
      
      return this.dataSource.transaction( (manager: EntityManager) => {

        // * get repositories
        const productRepository : Repository<Product> = manager.getRepository(Product);
        const productElementRepository: Repository<ProductElement> = manager.getRepository(ProductElement);

        return this.prepareEntity(new Product(), dto) // * prepare
        .then( (entity: Product) => this.save(entity, productRepository) ) // * save
        .then( (entity: Product) => {
          return (this.updateProductElement(entity, dto.elementList, productElementRepository)) // * create/update associated entity
          .then( (productElement: ProductElement[]) => this.generateProductWithElementList(entity, productElement, 0) ) // * generate dto
        })

      })
      .then( (dto: ProductDto) => {
        const end = performance.now();
        this.logger.log(`create: created OK, runtime=${(end - start) / 1000} seconds`);
        return dto;
      })

    })
    .catch(error => {
      if(error instanceof NotFoundException || error instanceof AlreadyExistException)
        throw error;

      this.logger.error(`create: error=${error.message}`);
      throw error;
    })
    
  }

  remove(id: string): Promise<string> {
    this.logger.warn(`remove: starting process... id=${id}`);
    const start = performance.now();

    return this.productRepository.findOne({
      where: { id },
    })
    .then( (entity: Product) => {

      // * validate
      if(!entity){
        const msg = `entity not found, id=${id}`;
        this.logger.warn(`remove: not executed (${msg})`);
        throw new NotFoundException(msg);
      }
      
      // * delete: update field active
      entity.active = false;
      return entity;
    })
    .then( (entity: Product) => this.save(entity) )
    .then( (entity: Product) => {
      const end = performance.now();
      this.logger.log(`remove: OK, runtime=${(end - start) / 1000} seconds`);
      return 'deleted';
    })
    .catch(error => {
      if(error instanceof NotFoundException)
        throw error;

      if(error.errno == 1217) {
        const msg = 'entity is being used';
        this.logger.warn(`remove: not executed (${msg})`, error);
        throw new IsBeingUsedException(msg);
      }

      this.logger.error('remove: error', error);
      throw error;
    })

  }

  // findOneById(id: string, companyId?: string): Promise<ProductDto[]> {
  //   const start = performance.now();

  //   const inputDto: SearchInputDto = new SearchInputDto(id);

  //   return this.findByValue({}, inputDto, companyId)
  //   .then( (entityList: Product[]) => entityList.map( (entity) => this.generateProductWithElementList(entity, entity.productElement) ) )
  //   .then( (dtoList: ProductDto[]) => {
      
  //     if(dtoList.length == 0){
  //       const msg = `product not found, id=${id}`;
  //       this.logger.warn(`findOneById: ${msg}`);
  //       throw new NotFoundException(msg);
  //     }

  //     const end = performance.now();
  //     this.logger.log(`findOneById: executed, runtime=${(end - start) / 1000} seconds`);
  //     return dtoList;
  //   })
  //   .catch(error => {
  //     if(error instanceof NotFoundException)
  //       throw error;

  //     this.logger.error(`findOneById: error`, error);
  //     throw error;
  //   })
    
  // }

  searchByValues(companyId: string, queryDto: ProductSearchInputQueryDto, inputDto: ProductSearchInputDto): Promise<ProductDto[]> {
    const start = performance.now();

    return this.searchEntitiesByValues(companyId, queryDto, inputDto)
    .then( (entityList: Product[]) => entityList.map( (entity) =>  queryDto.withMovements ? this.generateProductWithMovementList(entity) : this.generateProductWithElementList(entity, entity.productElement, 0) ) )
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

  private prepareEntity(entity: Product, dto: ProductDto): Promise<Product> {

    try {
      const company = new Company();
      company.id = dto.companyId;

      const productCategory = new ProductCategory();
      productCategory.id = dto.productCategoryId;

      const productUnit = new ProductUnit();
      productUnit.id = dto.productUnitId;

      entity.id           = dto.id ? dto.id : undefined;
      entity.company      = company;
      entity.name         = dto.name.toUpperCase();
      entity.code         = dto.code ? dto.code.toUpperCase() : undefined;
      entity.description  = dto.description ? dto.description.toUpperCase() : undefined;
      entity.unit         = dto.unit ? dto.unit.toUpperCase() : undefined;
      entity.cost         = this.calculateProductCost(dto); // * calculate cost
      entity.price        = dto.price;
      entity.type         = dto.type;
      entity.enable4Sale  = dto.enable4Sale;
      entity.productCategory = dto.productCategoryId ? productCategory : undefined;
      entity.productUnit  = dto.productUnitId ? productUnit : undefined;

      return Promise.resolve(entity);

    } catch (error) {
      this.logger.error(`prepareEntity: error`, error);
      throw error;
    }

    // // * find company
    // const inputDto: SearchInputDto = new SearchInputDto(dto.companyId);
    
    // return this.companyService.findByValue({}, inputDto)
    // .then( (companyList: Company[]) => {

    //   if(companyList.length == 0){
    //     const msg = `company id not found, id=${dto.companyId}`;
    //     this.logger.error(`prepareEntity: not executed (${msg})`);
    //     throw new NotFoundException(msg);
    //   }

    //   // * find product type
    //   const inputDto: SearchInputDto = new SearchInputDto(dto.productCategoryId);

    //   return ( dto.productCategoryId ? this.productCategoryService.findByValue({}, inputDto, dto.companyId) : Promise.resolve([]) )
    //   .then( (productCategoryList: ProductCategory[]) => {
        
    //     // * prepare entity
    //     entity.id           = dto.id ? dto.id : undefined;
    //     entity.company      = companyList[0];
    //     entity.name         = dto.name.toUpperCase();
    //     entity.code         = dto.code ? dto.code.toUpperCase() : undefined;
    //     entity.description  = dto.description ? dto.description.toUpperCase() : undefined;
    //     entity.unit         = dto.unit ? dto.unit.toUpperCase() : undefined;
    //     entity.cost         = this.calculateProductCost(dto); // * calculate cost
    //     entity.price        = dto.price;
    //     entity.type         = dto.type;
    //     entity.enable4Sale  = dto.enable4Sale;
    //     entity.productCategory  = productCategoryList.length > 0 ? productCategoryList[0] : undefined;

    //     return entity;
    //   })
    //   .catch( error => {
    //     this.logger.error(`prepareEntity: error`, error);
    //     throw error;
    //   })

    // })
    
  }

  private save(entity: Product, productRepository?: Repository<Product>): Promise<Product> {
    const start = performance.now();

    if(!productRepository)
      productRepository = this.productRepository;

    const newEntity: Product = productRepository.create(entity);

    return productRepository.save(newEntity)
    .then( (entity: Product) => {
      const end = performance.now();
      this.logger.log(`save: OK, runtime=${(end - start) / 1000} seconds, entity=${JSON.stringify(entity)}`);
      return entity;
    })
  }

  private updateProductElement(product: Product, productElementDtoList: ProductElementDto[] = [], productElementRepository: Repository<ProductElement>): Promise<ProductElement[]> {
    this.logger.log(`updateProductElement: starting process... product=${JSON.stringify(product)}, productElementDtoList=${JSON.stringify(productElementDtoList)}`);
    const start = performance.now();

    if(productElementDtoList.length == 0){
      this.logger.warn(`updateProductElement: not executed (product element list empty)`);
      return Promise.resolve([]);
    }

    // * find elements by id
    const elementIdList = productElementDtoList.map( (item) => item.element.id );
    // const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

    return this.findByIds({}, elementIdList)
    .then( (elementList: Product[]) => {

      // * validate
      if(elementList.length !== elementIdList.length){
        const elementIdNotFoundList: string[] = elementIdList.filter( (id) => !elementList.find( (element) => element.id == id) );
        const msg = `elements not found, idList=${JSON.stringify(elementIdNotFoundList)}`;
        throw new NotFoundException(msg);
      }

      // * create product-element
      return productElementRepository.find({
        where: { product },
      })
      .then( (productElementList: ProductElement[]) => productElementRepository.remove(productElementList)) // * remove productElements
      .then( () => {
        
        // * generate list to insert
        const productElementList: ProductElement[] = elementList.map( (element: Product) => {
          const productElement = new ProductElement();
          productElement.product = product;
          productElement.element = element;
          productElement.qty = productElementDtoList.find( (value) => value.element.id == element.id).qty;
          return  productElementRepository.create(productElement);
        })

        return productElementRepository
        .createQueryBuilder()
        .insert()
        .into(ProductElement)
        .values(productElementList)
        .execute()
        .then( (insertResult: InsertResult) => {
          const end = performance.now();
          this.logger.log(`updateProductElement: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
          return productElementList;
        })

      })

    })
    .catch(error => {
      this.logger.error(`updateProductElement: error=${error.message}`);
      throw error;
    })

  }

  // private updateProductElement(product: Product, productElementDtoList: ProductElementDto[] = []): Promise<ProductElement[]> {
  //   this.logger.log(`updateProductElement: starting process... product=${JSON.stringify(product)}, productElementDtoList=${JSON.stringify(productElementDtoList)}`);
  //   const start = performance.now();

  //   if(productElementDtoList.length == 0){
  //     this.logger.warn(`updateProductElement: not executed (product element list empty)`);
  //     return Promise.resolve([]);
  //   }

  //   // * find elements by id
  //   const elementIdList = productElementDtoList.map( (item) => item.element.id );
  //   // const inputDto: SearchInputDto = new SearchInputDto(undefined, undefined, elementIdList);

  //   return this.findByIds({}, elementIdList)
  //   .then( (elementList: Product[]) => {

  //     // * validate
  //     if(elementList.length !== elementIdList.length){
  //       const elementIdNotFoundList: string[] = elementIdList.filter( (id) => !elementList.find( (element) => element.id == id) );
  //       const msg = `elements not found, idList=${JSON.stringify(elementIdNotFoundList)}`;
  //       throw new NotFoundException(msg);
  //     }

  //     // * create productElement
  //     return this.productElementRepository.findBy( { product } ) // * find productElement
  //     .then( (productElementList: ProductElement[]) => this.productElementRepository.remove(productElementList)) // * remove productElements
  //     .then( () => {
        
  //       // * generate product element list
  //       const productElementList: ProductElement[] = elementList.map( (element: Product) => {
  //         const productElement = new ProductElement();
  //         productElement.product = product;
  //         productElement.element = element;
  //         productElement.qty = productElementDtoList.find( (value) => value.element.id == element.id).qty;
  //         return productElement;
  //       })
  
  //       // * bulk insert
  //       return this.bulkInsertProductElements(productElementList)
  //       .then( (productElementList: ProductElement[]) => {
  //         const end = performance.now();
  //         this.logger.log(`updateProductElement: OK, runtime=${(end - start) / 1000} seconds`);
  //         return productElementList;
  //       })

  //     })

  //   })

  // }

  // private bulkInsertProductElements(productElementList: ProductElement[]): Promise<ProductElement[]> {
  //   const start = performance.now();
  //   this.logger.log(`bulkInsertProductElements: starting process... listSize=${productElementList.length}`);

  //   const newProductElementList: ProductElement[] = productElementList.map( (value) => this.productElementRepository.create(value));
    
  //   return this.productElementRepository.manager.transaction( async(transactionalEntityManager) => {
      
  //     return transactionalEntityManager
  //       .createQueryBuilder()
  //       .insert()
  //       .into(ProductElement)
  //       .values(newProductElementList)
  //       .execute()
  //       .then( (insertResult: InsertResult) => {
  //         const end = performance.now();
  //         this.logger.log(`bulkInsertProductElements: OK, runtime=${(end - start) / 1000} seconds, insertResult=${JSON.stringify(insertResult.raw)}`);
  //         return newProductElementList;
  //       })
  //   })
  // }

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
        productCategory: true,
        productElement: { // TODO: agregar mas para acceder a niveles de producto compuesto mas abajo, aca solo se accede al primer nivel
          element: {
            productCategory: true,
            productElement: { // TODO: agregar mas para acceder a niveles de producto compuesto mas abajo, aca solo se accede al primer nivel
              element: true
            }
          }
        }
      }
      
    })
    
  }

  // private searchEntitiesByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductSearchInputDto): Promise<Product[]> {
  //   const {page=1, limit=this.dbDefaultLimit} = paginationDto;

  //   let query = this.productRepository.createQueryBuilder('p')
  //   .leftJoinAndSelect('p.company', 'c')
  //   .leftJoinAndSelect('p.productUnit', 'pu')
  //   .leftJoinAndSelect('p.productElement', 'pe')
  //   .leftJoinAndSelect('pe.element', 'e')
  //   .leftJoinAndSelect('e.company', 'c2')
  //   .where('p.companyId = :companyId', { companyId })
  //   .andWhere('p.active = :active', { active: true });

  //   .leftJoinAndSelect('p.productUnit', 'pu')
  //   .leftJoinAndSelect('p.movement', 'm')

  //   if(inputDto.nameCode) {
  //     const formatted = `%${inputDto.nameCode?.toLowerCase().replace(' ', '%')}%`;
  //     query.andWhere(
  //       new Brackets(qb => {
  //         qb.where('p.name LIKE :name').orWhere('p.code LIKE :code');
  //       }),
  //       {
  //         name: formatted,
  //         code: formatted,
  //       }
  //     );
  //   }

  //   if (inputDto.productTypeList?.length > 0) {
  //     query.andWhere('p.type IN (:...productTypeList)', { productTypeList: inputDto.productTypeList});
  //   }

  //   if(inputDto.productCategoryId) {
  //     query.andWhere('p.productCategoryId = :productCategoryId', { productCategoryId: inputDto.productCategoryId });
  //   }

  //   return query
  //   .skip((page - 1) * limit)
  //   .take(limit)
  //   .getMany();
  // }

  private searchEntitiesByValues(companyId: string, queryDto: ProductSearchInputQueryDto, inputDto: ProductSearchInputDto): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = queryDto;

    let query = this.productRepository.createQueryBuilder('p')
    .leftJoinAndSelect('p.company', 'c')
    .leftJoinAndSelect('p.productUnit', 'pu')
    
    if(queryDto.withMovements) {
      query
      .leftJoinAndSelect('p.movement', 'm')
      .leftJoinAndSelect('m.product', 'p2')
      .leftJoinAndSelect('m.user', 'u')

    } else {
      query
      .leftJoinAndSelect('p.productElement', 'pe')
      .leftJoinAndSelect('pe.element', 'e')
      .leftJoinAndSelect('e.productUnit', 'epu')
      .leftJoinAndSelect('e.company', 'c2')
    }

    query
    .where('p.companyId = :companyId', { companyId })
    .andWhere('p.active = :active', { active: true });

    if(inputDto.nameCode) {
      const formatted = `%${inputDto.nameCode?.toLowerCase().replace(' ', '%')}%`;
      query.andWhere(
        new Brackets(qb => {
          qb.where('p.name LIKE :name').orWhere('p.code LIKE :code');
        }),
        {
          name: formatted,
          code: formatted,
        }
      );
    }

    if (inputDto.productTypeList?.length > 0) {
      query.andWhere('p.type IN (:...productTypeList)', { productTypeList: inputDto.productTypeList});
    }

    if(inputDto.productCategoryId) {
      query.andWhere('p.productCategoryId = :productCategoryId', { productCategoryId: inputDto.productCategoryId });
    }

    if(inputDto.enable4Sale != undefined) {
      query.andWhere('p.enable4Sale = :enable4Sale', { enable4Sale: inputDto.enable4Sale });
    }

    query.orderBy('p.name', 'ASC');
    query.addOrderBy('p.id', 'ASC');

    return query
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  }

  private searchEntitiesWithMovementsByValues(companyId: string, paginationDto: SearchPaginationDto, inputDto: ProductSearchInputDto): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;

    const query = this.productRepository.createQueryBuilder('p')
    .leftJoinAndSelect('p.company', 'c')
    .leftJoinAndSelect('p.productUnit', 'pu')
    .leftJoinAndSelect('p.movement', 'm')
    .where('p.companyId = :companyId', { companyId })
    .andWhere('p.active = :active', { active: true });

    if(inputDto.nameCode) {
      const formatted = `%${inputDto.nameCode?.toLowerCase().replace(' ', '%')}%`;
      query.andWhere(
        new Brackets(qb => {
          qb.where('p.name LIKE :name').orWhere('p.code LIKE :code');
        }),
        {
          name: formatted,
          code: formatted,
        }
      );
    }

    if (inputDto.productTypeList?.length > 0) {
      query.andWhere('p.type IN (:...productTypeList)', { productTypeList: inputDto.productTypeList});
    }

    if(inputDto.productCategoryId) {
      query.andWhere('p.productCategoryId = :productCategoryId', { productCategoryId: inputDto.productCategoryId });
    }

    return query
    .skip((page - 1) * limit)
    .take(limit)
    .getMany();
  }
  
  private findByIds(paginationDto: SearchPaginationDto, idList: string[]): Promise<Product[]> {
    const {page=1, limit=this.dbDefaultLimit} = paginationDto;
    
    return this.productRepository.find({
      take: limit,
      skip: (page - 1) * limit,
      where: {
        id: In(idList),
        active: true
      },
      relations: {
        productElement: {
          element: true
        }
      }
    })
    
  }

  // private findByValue(paginationDto: SearchPaginationDto, inputDto: SearchInputDto, companyId?: string): Promise<Product[]> {
  //   const {page=1, limit=this.dbDefaultLimit} = paginationDto;

  //   // * search by id or partial value
  //   const value = inputDto.search;
  //   if(value) {
  //     const whereById     = { id: value, active: true };
  //     const whereByValue  = { company: { id: companyId }, name: value, active: true };
  //     const where = isUUID(value) ? whereById : whereByValue;

  //     return this.productRepository.find({
  //       take: limit,
  //       skip: (page - 1) * limit,
  //       where: where,
  //       relations: {
  //         productElement: {
  //           element: true
  //         }
  //       }
  //     })
  //   }

  //   // * search by value list
  //   if(inputDto.searchList) {
  //     return this.productRepository.find({
  //       take: limit,
  //       skip: (page - 1) * limit,
  //       where: {
  //         company: { 
  //           id: companyId 
  //         },
  //         name: Raw( (fieldName) => inputDto.searchList.map(value => `${fieldName} LIKE '%${value.replace(' ', '%')}%'`).join(' OR ') ),
  //         // name: In(inputDto.searchList),
  //         active: true
  //       },
  //       relations: {
  //         productElement: {
  //           element: true
  //         }
  //       }
  //     })
  //   }

  //   // * search by id list
  //   if(inputDto.idList?.length > 0) {
  //     return this.productRepository.find({
  //       take: limit,
  //       skip: (page - 1) * limit,
  //       where: {
  //         id: In(inputDto.idList),
  //         active: true
  //       },
  //       relations: {
  //         productElement: {
  //           element: true
  //         }
  //       }
  //     })
  //   }

  //   // * search all
  //   return this.productRepository.find({
  //     take: limit,
  //     skip: (page - 1) * limit,
  //     where: { 
  //       company: { 
  //         id: companyId 
  //       },
  //       active: true 
  //     },
  //     relations: {
  //       productElement: {
  //         element: true
  //       }
  //     }
  //   })
    
  // }

  // private generateProductWithElementList(product: Product, productElementList: ProductElement[]): ProductDto {

  //   let productElementDtoList: ProductElementDto[] = [];
  //   let cost: number = product.cost ? product.cost : 0 /*product.manualCost*/; // TODO: crear manual cost

  //   if(productElementList.length > 0){

  //     productElementDtoList = productElementList.map( (productElement: ProductElement) => {
  //       const element = productElement.element;
  //       const elementDto = new ProductDto(element.company.id, element.name, element.cost, element.type, element.enable4Sale, element.id, element.productCategory?.id, element.code, element.description, element.unit, element.price, productElementDtoList);
  //       return new ProductElementDto(elementDto, productElement.qty);
  //     });
      
  //   }

  //   // * generate product dto
  //   const productDto = new ProductDto(product.company.id, product.name, product.cost, product.type, product.enable4Sale, product.id, product.productCategory?.id, product.code, product.description, product.unit, product.price, productElementDtoList);
  //   return productDto;
  // }

  private generateProductWithElementList(product: Product, productElementList: ProductElement[] = [], level: number): ProductDto {

    if(level == 2) {
      const productDto = new ProductDto(product.company.id, product.name, product.cost, product.type, product.enable4Sale, product.id, product.productCategory?.id, product.productUnit?.id, product.code, product.description, product.productUnit?.name, product.price, []);
      return productDto;
    }

    // * generate product-element dto list
    let productElementDtoList: ProductElementDto[] = [];
    for (const productElement of productElementList) {
      const element = productElement.element;
      const elementDto = this.generateProductWithElementList(element, element.productElement, level + 1);
      const productElementDto = new ProductElementDto(elementDto, productElement.qty);
      productElementDtoList.push(productElementDto);
    }

    // * generate product dto
    const productDto = new ProductDto(product.company.id, product.name, product.cost, product.type, product.enable4Sale, product.id, product.productCategory?.id, product.productUnit?.id, product.code, product.description, product.productUnit?.name, product.price, productElementDtoList);
    return productDto;
  }

  private calculateProductCost(productDto: ProductDto): number {

    const productElementList: ProductElementDto[] = productDto.elementList;

    if(!productElementList || productElementList.length == 0) {
      return productDto.cost; // TODO: talvez falta crear otro campo cost manual el cual se utilice cuando no es un producto compuesto.
    }

    let cost = 0;
    for (const productElement of productElementList) {
      const element = productElement.element;

      if(element.type === ProductTypeEnum.PC || element.type === ProductTypeEnum.PCC) {
        cost += productElement.qty * this.calculateProductCost(element);
      } else {
        cost += productElement.qty * element.cost;
      }
    }

    return cost;
  }

  private generateProductWithMovementList(product: Product): ProductDto {
    const movementDtoList = product.movement.map(value => new MovementDto(value.type, value.reason, value.qty, value.product?.id, value.user?.id, value.id, value.relatedId))
    const productDto = new ProductDto(product.company.id, product.name, product.cost, product.type, product.enable4Sale, product.id, product.productCategory?.id, product.productUnit?.id, product.code, product.description, product.productUnit?.name, product.price, [], movementDtoList);
    return productDto;
  }
}
