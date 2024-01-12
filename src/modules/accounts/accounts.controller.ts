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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { AuthGuard } from './guards/auth.guard';
import { AccountCredentials } from './dto/account-credentials.dto';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true,
  skipMissingProperties: false,
});

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post('register')
  @ApiOperation({
    summary: 'Create a new account',
  })
  @ApiResponse({
    status: 201,
    description: 'Account created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g. missing or extra unknown field)',
  })
  @ApiResponse({
    status: 409,
    description: 'Account username is already taken',
  })
  @ApiResponse({
    status: 500,
    description:
      'Failed to create account because of some error on server (request was valid)',
  })
  async register(
    @Body(validationPipe)
    credentials: AccountCredentials,
  ): Promise<void> {
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
  @ApiOperation({
    summary: 'Login to an existing account',
  })
  @ApiResponse({
    status: 201,
    description: 'Account logged in successfully, JWT token returned',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request (e.g. missing or extra unknown field)',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid credentials',
  })
  @ApiResponse({
    status: 500,
    description:
      'Failed to login because of some error on server (request was valid)',
  })
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get account profile',
  })
  @ApiResponse({
    status: 200,
    description: 'Account profile returned',
    schema: {
      type: 'object',
      properties: {
        sub: {
          type: 'number',
        },
        username: {
          type: 'string',
        },
        iat: {
          type: 'number',
        },
        exp: {
          type: 'number',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing JWT token',
  })
  getProfile(@Request() req: any) {
    return req.user;
  }
}
