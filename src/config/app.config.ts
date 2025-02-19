import { env } from "process";

export const config = () => ({
    env: process.env.NODE_ENV,
    port: +process.env.PORT || 80,
    httpTimeout: +process.env.HTTP_TIMEOUT || 10000,
    httpMaxRedirects: +process.env.HTTP_MAX_REDIRECTS || 3,
    executionRetries: +process.env.EXECUTION_RETRIES || 2,
    executionBaseDelay: +process.env.EXECUTION_BASE_DELAY || 1000,
    
    useLocalStack: +process.env.USE_LOCAL_STACK,
    awsHost: process.env.AWS_HOST,
    awsRegion: process.env.AWS_REGION,
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID,
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    adminSnsTopicArn: process.env.ADMIN_SNS_TOPIC_ARN,
    productsSnsTopicArn: process.env.PRODUCTS_SNS_TOPIC_ARN,

    dbDefaultLimit: +process.env.DB_DEFAULT_LIMIT || 1000
  })