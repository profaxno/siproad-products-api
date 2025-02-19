import { ProcessSummaryDto, SearchInputDto, SearchPaginationDto } from 'profaxnojs/util';

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { MessageDto, DataReplicationDto } from './dto/data-replication.dto';
import { SourceEnum } from './enum';

import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

@Injectable()
export class DataReplicationService {

  private readonly logger = new Logger(DataReplicationService.name);
  
  private readonly useLocalStack: boolean = false;
  private readonly awsHost: string = "";
  private readonly awsRegion: string = "";
  private readonly awsAccessKeyId: string = "";
  private readonly awsSecretAccessKey: string = "";
  private readonly adminSnsTopicArn: string = "";
  private readonly productsSnsTopicArn: string = "";

  private readonly snsClient: SNSClient;  
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly configService: ConfigService
  ) {
    this.useLocalStack        = this.configService.get('useLocalStack') == 1 ? true : false;
    this.awsHost              = this.configService.get('awsHost');
    this.awsRegion            = this.configService.get('awsRegion');
    this.awsAccessKeyId       = this.configService.get('awsAccessKeyId');
    this.awsSecretAccessKey   = this.configService.get('awsSecretAccessKey');
    this.adminSnsTopicArn     = this.configService.get('adminSnsTopicArn');
    this.productsSnsTopicArn  = this.configService.get('productsSnsTopicArn');

    // * configure SNS client
    const snsConfig = { 
      region: this.awsRegion,
      credentials: {
        accessKeyId: this.awsAccessKeyId,
        secretAccessKey: this.awsSecretAccessKey,
      },
    }

    if(this.useLocalStack)
      snsConfig['endpoint'] = this.awsHost;

    this.snsClient = new SNSClient(snsConfig);

    // * configure SQS client
    this.sqsClient = new SQSClient({ region: this.awsRegion});
  }
  
  async sendMessages(dataReplicationDto: DataReplicationDto): Promise<ProcessSummaryDto> {
    this.logger.log(`sendMessages: process start...`);
    const start = performance.now();

    let processSummaryDto: ProcessSummaryDto = new ProcessSummaryDto(dataReplicationDto.messageList.length);

    if (processSummaryDto.totalRows === 0)
      return processSummaryDto; 

    // * process messages
    let rowProcessed = 0;
    for (const messageDto of dataReplicationDto.messageList) {
      
      await this.sendMessage(messageDto)
      .then( (result: string) => {
        processSummaryDto.rowsOK++;
        processSummaryDto.detailsRowsOK.push(`row=${rowProcessed}, response=${result}`);
      })
      .catch(err => {
        processSummaryDto.rowsKO++;
        processSummaryDto.detailsRowsKO.push(`row=${rowProcessed}, error=${err}`);
      })
      .finally( () => {
        rowProcessed++;
      });
    }

    const end = performance.now();
    this.logger.log(`sendMessages: executed, executionTime=${(end - start) / 1000} seconds, summary=${JSON.stringify(processSummaryDto)}`);
    return processSummaryDto;
  }

  private sendMessage(messageDto: MessageDto): Promise<string> {
    
    if(messageDto.source == SourceEnum.API_ADMIN){
      
      const command = new PublishCommand({
        TopicArn: this.adminSnsTopicArn,
        Message: JSON.stringify(messageDto)
      })
  
      this.logger.log(`sendMessage: command=${JSON.stringify(command)}`);
      return this.snsClient.send(command)
      .then( (result: any) => {
        return `message sent, messageId=${result.MessageId}`;
      })

    }

    if(messageDto.source == SourceEnum.API_PRODUCTS){

      const command = new PublishCommand({
        TopicArn: this.productsSnsTopicArn,
        Message: JSON.stringify(messageDto)
      })
  
      this.logger.log(`sendMessage: command=${JSON.stringify(command)}`);
      return this.snsClient.send(command)
      .then( (result: any) => {
        return `message sent, messageId=${result.MessageId}`;
      })

    }

    throw new Error(`source not implement, source=${messageDto.source}`);

  }

}
