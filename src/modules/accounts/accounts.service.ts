import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountsDatabaseService } from './modules/database/database.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AccountsService {
  constructor(
    private databaseService: AccountsDatabaseService,
    private jwtService: JwtService,
  ) {}

  async register(username: string, password: string) {
    const hash = await bcrypt.hash(password, 10);
    await this.databaseService.create(username, hash);
  }

  async login(username: string, password: string): Promise<any> {
    const user = await this.databaseService.findOne(username);
    if (
      !user ||
      !user?.password ||
      !(await bcrypt.compare(password, user.password))
    ) {
      throw new UnauthorizedException();
    }
    const payload = { sub: user.id, username: user.username };
    return {
      access_token: await this.jwtService.signAsync(payload),
    };
  }
}
