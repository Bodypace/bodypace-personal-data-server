import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsModule } from './modules/documents/documents.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: 'database/database.sqlite',
      autoLoadEntities: true,
      synchronize: true,
    }),
    DocumentsModule,
  ],
})
export class AppModule {}
