import { Module } from '@nestjs/common';
import { DataReplicationService } from './data-replication.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [],
  providers: [DataReplicationService],
  exports: [DataReplicationService]
})
export class DataReplicationModule {}
