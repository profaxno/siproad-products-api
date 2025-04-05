import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DataReceptionService } from './data-reception.service';
import { DataReceptionWorkerService } from './data-reception-redis-worker.service';
import { ProductsModule } from 'src/products/products.module';

@Module({
  controllers: [],
  providers: [DataReceptionService, DataReceptionWorkerService],
  imports: [ConfigModule, ProductsModule]
})
export class DataReceptionModule {}
