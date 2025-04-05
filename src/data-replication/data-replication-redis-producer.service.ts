import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { MessageDto } from './dto/message.dto';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';  // Import Redis from ioredis

@Injectable()
export class DataReplicationRedisProducerService {
  
  private readonly logger = new Logger(DataReplicationRedisProducerService.name);

  private readonly redisHost: string = "";
  private readonly redisPort: number = 0;
  private readonly redisPassword: string = ""; // Agregar la contraseña aquí
  private readonly redisFamily: string = ""; // IPv4

  private queue: Queue;

  constructor(
    private readonly configService: ConfigService
  ) {
    // Retrieve the Redis configuration values from ConfigService
    this.redisFamily = this.configService.get('redisFamily'); // * IPv4
    this.redisHost = this.configService.get('redisHost');
    this.redisPort = this.configService.get('redisPort');
    this.redisPassword = this.configService.get('redisPassword'); // Obtener la contraseña desde ConfigService
    

    // Create the Redis client using ioredis
    const redisClient = new Redis({
      host: this.redisHost + this.redisFamily,
      port: this.redisPort,
      password: this.redisPassword,  // Pass the password here
    });

    // Configure the BullMQ queue with the redisClient
    const dataConn = {
      family: 0,  // * IPv4
      connection: redisClient,
    }

    if (this.redisFamily === '')
      delete dataConn.family; // Remove the family property if not needed

    this.queue = new Queue('jobQueue', dataConn); // Create the queue with the Redis connection
  }

  // Method to send a message to the queue
  sendMessage(messageDto: MessageDto): Promise<string> {
    return this.queue.add('job', messageDto)
    .then((job) => `job generated, jobId=${job.id}`)
    .catch((error) => {
      this.logger.error(`sendMessage: error=${JSON.stringify(error)}`);
      throw new Error(`Error sending message to REDIS: ${error.message}`);
    });
  }
}
