import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Account } from './entities/account.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AccountsDatabaseService {
  constructor(
    @InjectRepository(Account)
    private accountsRepository: Repository<Account>,
  ) {}

  async create(username: string, password: string) {
    let missingProperty = '';
    if (!username) {
      missingProperty = 'username';
    }
    if (!password) {
      missingProperty = 'password';
    }
    if (missingProperty) {
      throw new Error(`"${missingProperty}" must be a non-empty string`);
    }

    const account = await this.findOne(username);
    if (account) {
      throw new Error('username is taken');
    }

    const newAccount = new Account();
    newAccount.username = username;
    newAccount.password = password;
    await this.accountsRepository.save(newAccount);
  }

  async findOne(username: string): Promise<Account | null> {
    if (!username) {
      throw new Error('"username" must be a non-empty string');
    }
    return await this.accountsRepository.findOneBy({
      username,
    });
  }
}
