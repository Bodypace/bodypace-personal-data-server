import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
  Request,
  ValidationPipe,
  InternalServerErrorException,
  ConflictException,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AuthGuard } from './guards/auth.guard';
import { AccountCredentials } from './dto/account-credentials.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  skipMissingProperties: false,
});

@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post('register')
  async register(
    @Body(validationPipe)
    credentials: AccountCredentials,
  ) {
    try {
      await this.accountsService.register(
        credentials.username,
        credentials.password,
      );
    } catch (error) {
      if (error.message === 'username is taken') {
        throw new ConflictException(
          'account username is already taken, try different one',
        );
      }
      // TODO: add { cause: error } for debugging
      // https://docs.nestjs.com/exception-filters
      throw new InternalServerErrorException(
        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
      );
    }
  }

  @Post('login')
  async login(@Body(validationPipe) credentials: AccountCredentials) {
    try {
      return await this.accountsService.login(
        credentials.username,
        credentials.password,
      );
    } catch (error) {
      if (error.status === 401) {
        throw error;
      }
      // TODO: add { cause: error } for debugging
      // https://docs.nestjs.com/exception-filters
      throw new InternalServerErrorException(
        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
      );
    }
  }

  @UseGuards(AuthGuard)
  @Get()
  getProfile(@Request() req: any) {
    return req.user;
  }
}
