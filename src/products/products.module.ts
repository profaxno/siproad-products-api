import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from './companies/entities/company.entity';
import { CompanyController } from './companies/company.controller';
import { CompanyService } from './companies/company.service';

import { User } from './users/entities/user.entity';
import { UserService } from './users/user.service';

import { Product, ProductElement, ProductCategory, Movement } from './products/entities';
import { ProductController } from './products/product.controller';
import { ProductCategoryController } from './products/product-category.controller';
import { ProductService } from './products/product.service';
import { ProductCategoryService } from './products/product-category.service';
import { MovementService } from './products/movement.service';

import { DataReplicationModule } from 'src/data-transfer/data-replication/data-replication.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Company, User, Product, ProductElement, ProductCategory, Movement], 'productsConn'),
    DataReplicationModule
  ],
  controllers: [CompanyController, ProductCategoryController, ProductController],
  providers: [CompanyService, ProductCategoryService, ProductService, UserService, MovementService],
  exports: [CompanyService, UserService, MovementService]
})
export class ProductModule {}
