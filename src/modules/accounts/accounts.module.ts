import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { AccountsDatabaseModule } from './modules/database/database.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    AccountsDatabaseModule,
    JwtModule.register({
      global: true,
      secret: process.env.BODYPACE_SERVER_JWT_SECRET,
      signOptions: {
        expiresIn: '60s',
      },
    }),
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
