import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  ValidationPipe,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AuthGuard } from './guards/auth.guard';
import { AccountCredentials } from './dto/account-credentials.dto';

@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post('register')
  async register(@Body(ValidationPipe) credentials: AccountCredentials) {
    await this.accountsService.register(
      credentials.username,
      credentials.password,
    );
  }

  @Post('login')
  login(@Body(ValidationPipe) credentials: AccountCredentials) {
    return this.accountsService.login(
      credentials.username,
      credentials.password,
    );
  }

  @UseGuards(AuthGuard)
  @Get()
  getProfile(@Request() req: any) {
    return req.user;
  }
}
