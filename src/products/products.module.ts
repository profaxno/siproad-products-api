import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';
import { Company } from './entities/company.entity';

import { ElementController } from './element.controller';
import { ElementService } from './element.service';
import { Element } from './entities/element.entity';

import { FormulaController } from './formula.controller';
import { FormulaService } from './formula.service';
import { Formula } from './entities/formula.entity';
import { FormulaElement } from './entities/formula-element.entity';

import { ProductController } from './product.controller';
import { ProductService } from './product.service';
import { Product } from './entities/product.entity';
import { ProductElement } from './entities/product-element.entity';
import { ProductFormula } from './entities/product-formula.entity';
import { DataReplicationModule } from 'src/data-replication/data-replication.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Company, Element, Formula, FormulaElement, Product, ProductElement, ProductFormula], 'productsConn'),
    DataReplicationModule
  ],
  controllers: [CompanyController, ElementController, FormulaController, ProductController],
  providers: [CompanyService, ElementService, FormulaService, ProductService],
  exports: []
})
export class ProductsModule {}
