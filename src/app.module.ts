import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';

import { config } from './config/app.config';

import { ProductsModule } from './products/products.module';
import { DataReceptionModule } from './data-transfer/data-reception/data-reception.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      load: [config]
    }),
    TypeOrmModule.forRoot({
      name: 'productsConn',
      type: 'mariadb',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT) || 3306,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      synchronize: false,
      autoLoadEntities: true
    }),
    ProductsModule,
    DataReceptionModule
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
