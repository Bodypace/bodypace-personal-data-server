import { Module } from '@nestjs/common';
import { AccountsDatabaseService } from './database.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  providers: [AccountsDatabaseService],
  exports: [AccountsDatabaseService],
})
export class AccountsDatabaseModule {}
