import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { User } from './users/entities/user.entity';
import { Conversation } from './conversations/entities/conversation.entity';
import { Message } from './messages/entities/message.entity';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate Limiting Configuration (Protection against DDoS and brute-force attacks)
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000, // Time window: 60 seconds (in milliseconds)
      limit: 10, // Max requests: 10 requests per IP per 60 seconds
    }]),

    // TypeORM Database Configuration
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        //type: 'mssql',
        type: 'mysql',
        host: configService.get<string>('DB_HOST'),
        port: Number(configService.get('DB_PORT')),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        entities: [User, Conversation, Message],
        synchronize: true, // previously, Set to false in production
        logging: configService.get<string>('NODE_ENV') === 'development',
        options:{
          // encrypt: true,  // Enforces TLS encryption for data in transit
          // trustServerCertificate: true // Certificate validation is disabled for development/demo environment due to self-signed cert (no CA-signed cert)
                                       // In production, this should be set to false and use a valid TLS certificate to prevent MITM attacks.
        },
      }),
      inject: [ConfigService],
    }),

    // Feature Modules
    AuthModule,
    UsersModule,
    ConversationsModule,
    MessagesModule,
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
