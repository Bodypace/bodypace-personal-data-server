import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import utils from './utils';
import type { TestAccount } from './utils';
import * as request from 'supertest';

const constants = utils.constants;

interface Fixtures {
  firstAccount: TestAccount;
  secondAccount: TestAccount;
}

describe('AccountsController (e2e)', () => {
  const fixtures: Fixtures = {
    firstAccount: {},
    secondAccount: {},
  };

  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    await utils.deleteDatabase(
      constants.databasePath,
      constants.databaseDocumentsDir,
      dataSource!,
    );

    app = undefined;
    dataSource = undefined;

    fixtures.firstAccount = {};
    fixtures.secondAccount = {};
  });

  it('dataSource should be defined', () => {
    expect(dataSource).toBeDefined();
  });

  describe('/accounts', () => {
    // TODO: HEAD

    describe('/register', () => {
      // TODO: HEAD

      describe('/ (POST)', () => {
        describe.each([
          ['that is empty', false],
          ['that already stores an account', true],
        ])('with database %s', (_, databaseShouldContainAccout: boolean) => {
          beforeEach(async () => {
            if (databaseShouldContainAccout) {
              fixtures.firstAccount.id = 1;
              fixtures.firstAccount.username = 'first account username';
              fixtures.firstAccount.password = 'first account password';

              await request(app!.getHttpServer())
                .post('/accounts/register')
                .send({
                  username: fixtures.firstAccount.username,
                  password: fixtures.firstAccount.password,
                })
                .expect(201)
                .expect({});
            }

            fixtures.secondAccount.id = databaseShouldContainAccout ? 2 : 1;
            fixtures.secondAccount.username = 'second account username';
            fixtures.secondAccount.password = 'second account password';
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

            describe('for request with correct username and password', () => {
              if (databaseShouldBeAvailable) {
                it('should 201, create new account and return nothing', async () => {
                  await request(app!.getHttpServer())
                    .post('/accounts/register')
                    .send({
                      username: fixtures.secondAccount.username,
                      password: fixtures.secondAccount.password,
                    })
                    .expect(201)
                    .expect({});

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccout
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [fixtures.secondAccount],
                    true,
                    dataSource!,
                  );
                });
              } else {
                it('should 500, not alter database and return message that explains error cause', async () => {
                  await request(app!.getHttpServer())
                    .post('/accounts/register')
                    .send({
                      username: fixtures.secondAccount.username,
                      password: fixtures.secondAccount.password,
                    })
                    .expect(500)
                    .expect({
                      message:
                        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                      error: 'Internal Server Error',
                      statusCode: 500,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                    false,
                    dataSource!,
                  );
                });
              }
            });

            if (databaseShouldContainAccout) {
              describe('for request with correct password and already taken username', () => {
                if (databaseShouldBeAvailable) {
                  it('should 409, not alter database and return message that explains error cause', async () => {
                    fixtures.secondAccount.username =
                      fixtures.firstAccount.username;

                    await request(app!.getHttpServer())
                      .post('/accounts/register')
                      .send({
                        username: fixtures.secondAccount.username,
                        password: fixtures.secondAccount.password,
                      })
                      .expect(409)
                      .expect({
                        message:
                          'account username is already taken, try different one',
                        error: 'Conflict',
                        statusCode: 409,
                      });

                    await utils.expectDatabaseHasAccounts(
                      constants.databasePath,
                      [fixtures.firstAccount],
                      true,
                      dataSource!,
                    );
                  });
                } else {
                  it('should 500, not alter database and return message that explains error cause', async () => {
                    fixtures.secondAccount.username =
                      fixtures.firstAccount.username;

                    await request(app!.getHttpServer())
                      .post('/accounts/register')
                      .send({
                        username: fixtures.secondAccount.username,
                        password: fixtures.secondAccount.password,
                      })
                      .expect(500)
                      .expect({
                        message:
                          'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                        error: 'Internal Server Error',
                        statusCode: 500,
                      });

                    await utils.expectDatabaseHasAccounts(
                      constants.databasePath,
                      [fixtures.firstAccount],
                      false,
                      dataSource!,
                    );
                  });
                }
              });

              describe('for request with correct password and already taken username but different case', () => {
                if (databaseShouldBeAvailable) {
                  it('should 201, create new account and return nothing', async () => {
                    fixtures.secondAccount.username =
                      fixtures.firstAccount.username!.toUpperCase();

                    await request(app!.getHttpServer())
                      .post('/accounts/register')
                      .send({
                        username: fixtures.secondAccount.username,
                        password: fixtures.secondAccount.password,
                      })
                      .expect(201)
                      .expect({});

                    await utils.expectDatabaseHasAccounts(
                      constants.databasePath,
                      [fixtures.firstAccount, fixtures.secondAccount],
                      true,
                      dataSource!,
                    );
                  });
                }
              });
            }

            describe('for request with additional unknown field', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                const unknownExtraField = 'unknownExtraField';

                const data = {
                  username: fixtures.secondAccount.username,
                  password: fixtures.secondAccount.password,
                  [unknownExtraField]: 'unknown extra field value',
                };

                await request(app!.getHttpServer())
                  .post('/accounts/register')
                  .send(data)
                  .expect(400)
                  .expect({
                    message: [`property ${unknownExtraField} should not exist`],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await utils.expectDatabaseHasAccounts(
                  constants.databasePath,
                  databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            });

            describe.each([
              ['username', 'Username'],
              ['username', 'USERNAME'],
              ['username', 'usename'],
              ['password', 'Password'],
              ['password', 'PASSWORD'],
              ['password', 'passwrod'],
            ])(
              'for request with `%s` instead of `%s`',
              (missingKey: 'username' | 'password', replacingKey) => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  const data = {
                    username: fixtures.secondAccount.username,
                    password: fixtures.secondAccount.password,
                    [replacingKey]: fixtures.secondAccount[missingKey],
                  };

                  delete data[missingKey];

                  await request(app!.getHttpServer())
                    .post('/accounts/register')
                    .send(data)
                    .expect(400)
                    .expect({
                      message: [
                        `property ${replacingKey} should not exist`,
                        `${missingKey} should not be empty`,
                        `${missingKey} must be a string`,
                      ],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe.each([['username'], ['password']])(
              'for reqeust with `%s` set to empty string',
              (keyWithEmptyString: 'username' | 'password') => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  const data = {
                    username: fixtures.secondAccount.username,
                    password: fixtures.secondAccount.password,
                  };

                  data[keyWithEmptyString] = '';

                  await request(app!.getHttpServer())
                    .post('/accounts/register')
                    .send(data)
                    .expect(400)
                    .expect({
                      message: [`${keyWithEmptyString} should not be empty`],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe.each([['username'], ['password']])(
              'for reqeust with missing `%s`',
              (missingKey: 'username' | 'password') => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  const data = {
                    username: fixtures.secondAccount.username,
                    password: fixtures.secondAccount.password,
                  };

                  delete data[missingKey];

                  await request(app!.getHttpServer())
                    .post('/accounts/register')
                    .send(data)
                    .expect(400)
                    .expect({
                      message: [
                        `${missingKey} should not be empty`,
                        `${missingKey} must be a string`,
                      ],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe('for request with missing both `username` and `password`', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/accounts/register')
                  .send({})
                  .expect(400)
                  .expect({
                    message: [
                      'username should not be empty',
                      'username must be a string',
                      'password should not be empty',
                      'password must be a string',
                    ],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await utils.expectDatabaseHasAccounts(
                  constants.databasePath,
                  databaseShouldContainAccout ? [fixtures.firstAccount] : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            });
          });
        });
      });

      // TODO: GET
      // TODO: UPDATE
      // TODO: PATCH
      // TODO: DELETE
    });

    describe('/login', () => {
      // TODO: HEAD

      describe('/ (POST)', () => {
        it('TODO', () => {});
      });

      // TODO: GET
      // TODO: UPDATE
      // TODO: PATCH
      // TODO: DELETE
    });

    describe('/ (GET)', () => {
      it('TODO', () => {});
    });

    // TODO: UPDATE
    // TODO: PATCH
    // TODO: DELETE
  });
});
