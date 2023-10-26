import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountsDatabaseService } from './database.service';
import { Account } from './entities/account.entity';
import utils from '../../../../../test/utils';
import type { TestAccount } from '../../../../../test/utils';

interface Fixtures {
  firstAccount: TestAccount;
  secondAccount: TestAccount;
}

const constants = {
  databasePath: 'database/accounts-database-service-test.sqlite',
  databaseDocumentsDir: 'database/documents',
};

describe('AccountsDatabaseService', () => {
  const fixtures: Fixtures = {
    firstAccount: {},
    secondAccount: {},
  };

  let service: AccountsDatabaseService | undefined;
  let dataSource: DataSource | undefined;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: constants.databasePath,
          autoLoadEntities: true,
          synchronize: true,
          dropSchema: true,
        }),
        TypeOrmModule.forFeature([Account]),
      ],
      providers: [AccountsDatabaseService],
    }).compile();

    service = module.get<AccountsDatabaseService>(AccountsDatabaseService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await utils.deleteDatabase(
      constants.databasePath,
      constants.databaseDocumentsDir,
      dataSource!,
    );

    fixtures.firstAccount = {};
    fixtures.secondAccount = {};

    service = undefined;
    dataSource = undefined;
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  it('dataSource should be defined', () => {
    expect(dataSource).toBeDefined();
  });

  describe('create()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores account', true],
    ])('with database %s', (_, databaseShouldContainAccount) => {
      beforeEach(async () => {
        if (databaseShouldContainAccount) {
          fixtures.firstAccount.id = 1;
          fixtures.firstAccount.username = 'first-user';
          fixtures.firstAccount.password = 'first-user-password';

          await service!.create(
            fixtures.firstAccount.username,
            fixtures.firstAccount.password,
          );
        }

        fixtures.secondAccount.id = databaseShouldContainAccount ? 2 : 1;
        fixtures.secondAccount.username = 'second-user';
        fixtures.secondAccount.password = 'second-user-password';
      });

      describe.each([
        ['available', true],
        ['not available', false],
      ])('with database %s', (_, databaseShouldBeAvailable: boolean) => {
        beforeEach(async () => {
          if (!databaseShouldBeAvailable) {
            await dataSource!.destroy();
          }
        });

        describe('for correct username and password', () => {
          if (databaseShouldBeAvailable) {
            it('should store new account in database and return nothing', async () => {
              await expect(
                service!.create(
                  fixtures.secondAccount.username!,
                  fixtures.secondAccount.password!,
                ),
              ).resolves.toBeUndefined();

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                databaseShouldContainAccount
                  ? [fixtures.firstAccount, fixtures.secondAccount]
                  : [fixtures.secondAccount],
                true,
                dataSource!,
              );
            });
          } else {
            it('should not alter database and throw descriptive error', async () => {
              await expect(
                service!.create(
                  fixtures.secondAccount.username!,
                  fixtures.secondAccount.password!,
                ),
              ).rejects.toThrow(
                'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                databaseShouldContainAccount ? [fixtures.firstAccount] : [],
                false,
                dataSource!,
              );
            });
          }
        });

        if (databaseShouldContainAccount) {
          describe('for correct password but username is already taken', () => {
            it('should not alter database and throw descriptive error', async () => {
              fixtures.secondAccount.username = fixtures.firstAccount.username;

              await expect(
                service!.create(
                  fixtures.secondAccount.username!,
                  fixtures.secondAccount.password!,
                ),
              ).rejects.toThrow(
                databaseShouldBeAvailable
                  ? 'username is taken'
                  : 'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                [fixtures.firstAccount],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        }

        describe.each([['username'], ['password']])(
          'for %s that is an empty string',
          (emptyProperty: 'username' | 'password') => {
            it('should not alter database and throw descriptive error', async () => {
              fixtures.secondAccount[emptyProperty] = '';

              await expect(
                service!.create(
                  fixtures.secondAccount.username!,
                  fixtures.secondAccount.password!,
                ),
              ).rejects.toThrow(
                `"${emptyProperty}" must be a non-empty string`,
              );

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                databaseShouldContainAccount ? [fixtures.firstAccount] : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          },
        );

        describe('for username and password both being empty string', () => {
          it('should not alter database and throw descriptive error', async () => {
            fixtures.secondAccount.username = '';
            fixtures.secondAccount.password = '';

            await expect(
              service!.create(
                fixtures.secondAccount.username!,
                fixtures.secondAccount.password!,
              ),
            ).rejects.toThrow(`"password" must be a non-empty string`);

            await utils.expectDatabaseAccountsState(
              constants.databasePath,
              databaseShouldContainAccount ? [fixtures.firstAccount] : [],
              databaseShouldBeAvailable,
              dataSource!,
            );
          });
        });
      });
    });
  });

  describe('findOne()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores accounts', true],
    ])('with database %s', (_, databaseShouldContainAccounts) => {
      beforeEach(async () => {
        if (databaseShouldContainAccounts) {
          fixtures.firstAccount.id = 1;
          fixtures.firstAccount.username = 'first-user';
          fixtures.firstAccount.password = 'first-user-password';

          await service!.create(
            fixtures.firstAccount.username,
            fixtures.firstAccount.password,
          );

          fixtures.secondAccount.id = 2;
          fixtures.secondAccount.username = 'second-user';
          fixtures.secondAccount.password = 'second-user-password';

          await service!.create(
            fixtures.secondAccount.username,
            fixtures.secondAccount.password,
          );
        }
      });

      describe.each([
        ['available', true],
        ['not available', false],
      ])('with database %s', (_, databaseShouldBeAvailable: boolean) => {
        beforeEach(async () => {
          if (!databaseShouldBeAvailable) {
            await dataSource!.destroy();
          }
        });

        if (databaseShouldContainAccounts) {
          describe.each([
            ['first-user', 1],
            ['second-user', 2],
          ])(
            'for known username - %s',
            (knownUsername: string, expectedAccountId: number) => {
              if (databaseShouldBeAvailable) {
                it('should not alter database and return matching account', async () => {
                  const expectedAccount =
                    expectedAccountId === fixtures.firstAccount.id
                      ? fixtures.firstAccount
                      : fixtures.secondAccount;

                  expect(expectedAccount.id).toBe(expectedAccountId);

                  await expect(
                    service!.findOne(knownUsername),
                  ).resolves.toStrictEqual(
                    utils.newAccount(
                      expectedAccount.id!,
                      expectedAccount.username!,
                      expectedAccount.password!,
                    ),
                  );

                  await utils.expectDatabaseAccountsState(
                    constants.databasePath,
                    [fixtures.firstAccount, fixtures.secondAccount],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              } else {
                it('should not alter database and throw descriptive error', async () => {
                  const expectedAccount =
                    expectedAccountId === fixtures.firstAccount.id
                      ? fixtures.firstAccount
                      : fixtures.secondAccount;

                  expect(expectedAccount.id).toBe(expectedAccountId);

                  await expect(service!.findOne(knownUsername)).rejects.toThrow(
                    'Connection with sqlite database is not established. Check connection configuration.',
                  );

                  await utils.expectDatabaseAccountsState(
                    constants.databasePath,
                    [fixtures.firstAccount, fixtures.secondAccount],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              }
            },
          );
        }

        describe('for unknown username', () => {
          if (databaseShouldBeAvailable) {
            it('should not alter database and return null', async () => {
              const unknownUsername = 'not-existing-username';

              await expect(
                service!.findOne(unknownUsername),
              ).resolves.toBeNull();

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                databaseShouldContainAccounts
                  ? [fixtures.firstAccount, fixtures.secondAccount]
                  : [],
                true,
                dataSource!,
              );
            });
          } else {
            it('should not alter database and throw descriptive error', async () => {
              const unknownUsername = 'not-existing-username';

              await expect(service!.findOne(unknownUsername)).rejects.toThrow(
                'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseAccountsState(
                constants.databasePath,
                databaseShouldContainAccounts
                  ? [fixtures.firstAccount, fixtures.secondAccount]
                  : [],
                false,
                dataSource!,
              );
            });
          }
        });

        describe('for username being empty string', () => {
          it('should not alter database and throw descriptive error', async () => {
            await expect(service!.findOne('')).rejects.toThrow(
              '"username" must be a non-empty string',
            );

            await utils.expectDatabaseAccountsState(
              constants.databasePath,
              databaseShouldContainAccounts
                ? [fixtures.firstAccount, fixtures.secondAccount]
                : [],
              databaseShouldBeAvailable,
              dataSource!,
            );
          });
        });
      });
    });
  });
});
