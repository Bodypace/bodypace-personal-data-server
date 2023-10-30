import utils from './utils';

const constants = utils.constants;

process.env[constants.jwtSecretEnvKey] =
  'SOME COMPLEX LONG RANDOM SEQUENCE THAT NOBODY CAN KNOW';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import type { TestAccount } from './utils';
import * as request from 'supertest';

interface Fixtures {
  firstAccount: TestAccount;
  secondAccount: TestAccount;
  thirdAccount: TestAccount;
}

describe('AccountsController (e2e)', () => {
  const fixtures: Fixtures = {
    firstAccount: {},
    secondAccount: {},
    thirdAccount: {},
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
    fixtures.thirdAccount = {};
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
        describe.each([
          ['that is empty', false],
          ['that already stores two accounts', true],
        ])('with database %s', (_, databaseShouldContainAccouts: boolean) => {
          beforeEach(async () => {
            fixtures.firstAccount.id = 1;
            fixtures.firstAccount.username = 'first account username';
            fixtures.firstAccount.password = 'first account password';

            fixtures.secondAccount.id = 2;
            fixtures.secondAccount.username = 'second account username';
            fixtures.secondAccount.password = 'second account password';

            fixtures.thirdAccount.username = 'unknown username';
            fixtures.thirdAccount.password = 'unknown password';

            if (databaseShouldContainAccouts) {
              await request(app!.getHttpServer())
                .post('/accounts/register')
                .send({
                  username: fixtures.firstAccount.username,
                  password: fixtures.firstAccount.password,
                })
                .expect(201)
                .expect({});

              await request(app!.getHttpServer())
                .post('/accounts/register')
                .send({
                  username: fixtures.secondAccount.username,
                  password: fixtures.secondAccount.password,
                })
                .expect(201)
                .expect({});
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

            if (databaseShouldBeAvailable) {
              if (databaseShouldContainAccouts) {
                describe.each([
                  ['first account', 1],
                  ['second account', 2],
                ])(
                  'for request with correct credentials - %s',
                  (_, accountId) => {
                    it('should 201, not alter database and return access token', async () => {
                      const account =
                        accountId === fixtures.firstAccount.id
                          ? fixtures.firstAccount
                          : fixtures.secondAccount;

                      expect(account.id).toBe(accountId);

                      const response = await request(app!.getHttpServer())
                        .post('/accounts/login')
                        .send({
                          username: account.username,
                          password: account.password,
                        })
                        .expect(201); // TODO: maybe different code is better

                      expect(response.body.access_token).toBeDefined();
                      expect(response.body.access_token).toBeTruthy();
                      expect(response.body.access_token.length).toBeGreaterThan(
                        150,
                      );

                      await utils.expectDatabaseHasAccounts(
                        constants.databasePath,
                        [fixtures.firstAccount, fixtures.secondAccount],
                        true,
                        dataSource!,
                      );
                    });
                  },
                );

                describe.each([
                  ['same account twice - no wait', 1, false, 'same'],
                  ['same account twice - wait 1 sec', 1, true, 'different'],
                  ['different accounts - no wait', 2, false, 'different'],
                  ['different accounts - wait 1 sec', 2, true, 'different'],
                ])(
                  'for two requests with correct credentials - %s',
                  (_, secondAccountId, shouldWait, tokensShouldBeDesc) => {
                    it(
                      'should 201, not alter database and return access token (twice, ' +
                        tokensShouldBeDesc +
                        ' tokens)',
                      async () => {
                        const responseNo1 = await request(app!.getHttpServer())
                          .post('/accounts/login')
                          .send({
                            username: fixtures.firstAccount.username,
                            password: fixtures.firstAccount.password,
                          })
                          .expect(201);

                        expect(responseNo1.body.access_token).toBeDefined();
                        expect(responseNo1.body.access_token).toBeTruthy();
                        expect(
                          responseNo1.body.access_token.length,
                        ).toBeGreaterThan(150);

                        const secondAccount =
                          secondAccountId === fixtures.firstAccount.id
                            ? fixtures.firstAccount
                            : fixtures.secondAccount;

                        expect(secondAccount.id).toBe(secondAccountId);

                        if (shouldWait) {
                          await new Promise((resolve) =>
                            setTimeout(resolve, 1000),
                          );
                        }

                        const responseNo2 = await request(app!.getHttpServer())
                          .post('/accounts/login')
                          .send({
                            username: secondAccount.username,
                            password: secondAccount.password,
                          })
                          .expect(201);

                        expect(responseNo2.body.access_token).toBeDefined();
                        expect(responseNo2.body.access_token).toBeTruthy();
                        expect(
                          responseNo2.body.access_token.length,
                        ).toBeGreaterThan(150);

                        if (tokensShouldBeDesc === 'same') {
                          expect(responseNo1.body.access_token).toBe(
                            responseNo2.body.access_token,
                          );
                        } else {
                          expect(responseNo1.body.access_token).not.toBe(
                            responseNo2.body.access_token,
                          );
                        }

                        await utils.expectDatabaseHasAccounts(
                          constants.databasePath,
                          [fixtures.firstAccount, fixtures.secondAccount],
                          true,
                          dataSource!,
                        );
                      },
                    );
                  },
                );

                describe.each([
                  ['username', 'password'],
                  ['password', 'username'],
                ])(
                  'for request with correct `%s` and incorrect `%s`',
                  (_, fieldWithInvalidValue: 'username' | 'password') => {
                    it('should 401, not alter database and return message that explains error cause', async () => {
                      fixtures.thirdAccount = {
                        username: fixtures.firstAccount.username,
                        password: fixtures.firstAccount.password,
                        [fieldWithInvalidValue]: 'invalid value',
                      };

                      await request(app!.getHttpServer())
                        .post('/accounts/login')
                        .send({
                          username: fixtures.thirdAccount.username,
                          password: fixtures.thirdAccount.password,
                        })
                        .expect(401)
                        .expect({
                          message: 'Unauthorized',
                          statusCode: 401,
                        });

                      await utils.expectDatabaseHasAccounts(
                        constants.databasePath,
                        [fixtures.firstAccount, fixtures.secondAccount],
                        true,
                        dataSource!,
                      );
                    });
                  },
                );
              }

              describe('for request with incorrect credentials', () => {
                it('should 401, not alter database and return message that explains error cause', async () => {
                  await request(app!.getHttpServer())
                    .post('/accounts/login')
                    .send({
                      username: fixtures.thirdAccount.username,
                      password: fixtures.thirdAccount.password,
                    })
                    .expect(401)
                    .expect({
                      message: 'Unauthorized',
                      statusCode: 401,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccouts
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [],
                    true,
                    dataSource!,
                  );
                });
              });
            }

            if (!databaseShouldBeAvailable) {
              if (databaseShouldContainAccouts) {
                describe.each([
                  ['first account', 1],
                  ['second account', 2],
                ])(
                  'for request with correct credentials - %s',
                  (_, accountId) => {
                    it('should 500, not alter database and return message that explains error cause', async () => {
                      const account =
                        accountId === fixtures.firstAccount.id
                          ? fixtures.firstAccount
                          : fixtures.secondAccount;

                      expect(account.id).toBe(accountId);

                      await request(app!.getHttpServer())
                        .post('/accounts/login')
                        .send({
                          username: account.username,
                          password: account.password,
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
                        [fixtures.firstAccount, fixtures.secondAccount],
                        false,
                        dataSource!,
                      );
                    });
                  },
                );
              }

              describe('for request with incorrect credentials', () => {
                it('should 500, not alter database and return message that explains error cause', async () => {
                  await request(app!.getHttpServer())
                    .post('/accounts/login')
                    .send({
                      username: fixtures.thirdAccount.username,
                      password: fixtures.thirdAccount.password,
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
                    databaseShouldContainAccouts
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [],
                    false,
                    dataSource!,
                  );
                });
              });
            }

            describe.each([
              ['username', 'Username'],
              ['username', 'USERNAME'],
              ['username', 'usernme'],
              ['password', 'Password'],
              ['password', 'PASSWORD'],
              ['password', 'passwrd'],
            ])(
              'for request with `%s` replaced by `%s`',
              (missingField: 'username' | 'password', unknownField) => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  fixtures.thirdAccount = {
                    username: fixtures.firstAccount.username,
                    password: fixtures.firstAccount.password,
                    [unknownField]: 'random value',
                  };

                  delete fixtures.thirdAccount[missingField];

                  await request(app!.getHttpServer())
                    .post('/accounts/login')
                    .send(fixtures.thirdAccount)
                    .expect(400)
                    .expect({
                      message: [
                        `property ${unknownField} should not exist`,
                        `${missingField} should not be empty`,
                        `${missingField} must be a string`,
                      ],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccouts
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe('for request with extra field', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                const unknownFieldName = 'unknownField';

                await request(app!.getHttpServer())
                  .post('/accounts/login')
                  .send({
                    username: fixtures.firstAccount.username,
                    password: fixtures.firstAccount.password,
                    [unknownFieldName]: 'random value',
                  })
                  .expect(400)
                  .expect({
                    message: [`property ${unknownFieldName} should not exist`],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await utils.expectDatabaseHasAccounts(
                  constants.databasePath,
                  databaseShouldContainAccouts
                    ? [fixtures.firstAccount, fixtures.secondAccount]
                    : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            });

            describe.each([['username'], ['password']])(
              'for request with `%s` set to empty string',
              (fieldWithEmptyString: 'username' | 'password') => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  fixtures.thirdAccount = {
                    username: fixtures.firstAccount.username,
                    password: fixtures.firstAccount.password,
                    [fieldWithEmptyString]: '',
                  };

                  await request(app!.getHttpServer())
                    .post('/accounts/login')
                    .send(fixtures.thirdAccount)
                    .expect(400)
                    .expect({
                      message: [`${fieldWithEmptyString} should not be empty`],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccouts
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe('for request with `username` and `password` set to empty string', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/accounts/login')
                  .send({
                    username: '',
                    password: '',
                  })
                  .expect(400)
                  .expect({
                    message: [
                      'username should not be empty',
                      'password should not be empty',
                    ],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await utils.expectDatabaseHasAccounts(
                  constants.databasePath,
                  databaseShouldContainAccouts
                    ? [fixtures.firstAccount, fixtures.secondAccount]
                    : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            });

            describe.each([['username'], ['password']])(
              'for request with missing `%s`',
              (missingField: 'username' | 'password') => {
                it('should 400, not alter database and return message that explains error cause', async () => {
                  fixtures.thirdAccount = {
                    username: fixtures.firstAccount.username,
                    password: fixtures.firstAccount.password,
                  };

                  delete fixtures.thirdAccount[missingField];

                  await request(app!.getHttpServer())
                    .post('/accounts/login')
                    .send(fixtures.thirdAccount)
                    .expect(400)
                    .expect({
                      message: [
                        `${missingField} should not be empty`,
                        `${missingField} must be a string`,
                      ],
                      error: 'Bad Request',
                      statusCode: 400,
                    });

                  await utils.expectDatabaseHasAccounts(
                    constants.databasePath,
                    databaseShouldContainAccouts
                      ? [fixtures.firstAccount, fixtures.secondAccount]
                      : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );

            describe('for request with missing `username` and `password`', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/accounts/login')
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
                  databaseShouldContainAccouts
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
