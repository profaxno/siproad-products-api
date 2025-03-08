import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

import { ProductTypeController } from './product-type.controller';
import { ProductTypeService } from './product-type.service';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';

import { FormulaController } from './formula.controller';
import { FormulaService } from './formula.service';

import { ElementController } from './element.controller';
import { ElementService } from './element.service';

import { ElementTypeController } from './element-type.controller';
import { ElementTypeService } from './element-type.service';

import { Company, ProductType, Product, ProductFormula, Formula, FormulaElement, Element, ElementType, ProductElement } from './entities';

import { DataReplicationModule } from 'src/data-replication/data-replication.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Company, ProductType, Product, ProductFormula, Formula, FormulaElement, Element, ElementType, ProductElement], 'productsConn'),
    DataReplicationModule
  ],
  controllers: [CompanyController, ProductTypeController, ProductController, FormulaController, ElementController, ElementTypeController],
  providers: [CompanyService, ProductTypeService, ProductService, FormulaService, ElementService, ElementTypeService],
  exports: []
})
export class ProductsModule {}
