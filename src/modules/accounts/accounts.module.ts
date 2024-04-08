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
        // TODO: this value is probably too long, it was set to 2 days for developer and free-beta convenience
        expiresIn: '2 days',
      },
    }),
  ],
  providers: [AccountsService],
  controllers: [AccountsController],
  exports: [AccountsService],
})
export class AccountsModule {}
