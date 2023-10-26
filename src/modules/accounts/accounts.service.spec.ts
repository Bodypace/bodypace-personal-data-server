import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsDatabaseModule } from './modules/database/database.module';
import { AccountsDatabaseService } from './modules/database/database.service';
import type { TestAccount } from '../../../test/utils';
import utils from '../../../test/utils';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

const constants = {
  databasePath: 'database/accounts-service-test.sqlite',
  jwtSecret:
    'DO NOT USE THIS VALUE. INSTEAD, CREATE A COMPLEX SECRET AND KEEP IT SAFE OUTSIDE OF THE SOURCE CODE.',
  bcryptHashRounds: 10,
};

interface Fixtures {
  user?: TestAccount;
  username?: string;
  password?: string;
  accessToken?: string;
}

interface MockedModules {
  bcrypt: {
    hash?: jest.Mock<any, any, any>;
    compare?: jest.Mock<any, any, any>;
  };
}

function MockedAccountsDatabaseService() {
  return {
    create: jest.fn(),
    findOne: jest.fn(),
  };
}

function MockedJwtService() {
  return {
    signAsync: jest.fn(),
  };
}

function MockedBcryptHash(): jest.Mock<any, any, any> {
  return jest
    .fn()
    .mockImplementation((data) => Promise.resolve(`hashed ${data}`));
}

function MockedBcryptCompare(): jest.Mock<any, any, any> {
  return jest
    .fn()
    .mockImplementation((data, hash) =>
      Promise.resolve(`hashed ${data}` === hash),
    );
}

describe('AccountsService', () => {
  const fixtures: Fixtures = {};

  let service: AccountsService;
  let databaseService: AccountsDatabaseService;
  let jwtService: JwtService;

  const mockedModules: MockedModules = {
    bcrypt: {
      hash: undefined,
      compare: undefined,
    },
  };

  beforeAll(() => {
    jest
      .spyOn(bcrypt, 'hash')
      .mockImplementation((...args) => mockedModules.bcrypt.hash!(...args));
    jest
      .spyOn(bcrypt, 'compare')
      .mockImplementation((...args) => mockedModules.bcrypt.compare!(...args));
  });

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
        AccountsDatabaseModule,
        JwtModule.register({
          global: true,
          secret: constants.jwtSecret,
          signOptions: {
            expiresIn: '60s',
          },
        }),
      ],
      providers: [AccountsService],
    })
      .overrideProvider(AccountsDatabaseService)
      .useValue(MockedAccountsDatabaseService())
      .overrideProvider(JwtService)
      .useValue(MockedJwtService())
      .compile();

    service = module.get<AccountsService>(AccountsService);
    databaseService = module.get<AccountsDatabaseService>(
      AccountsDatabaseService,
    );
    jwtService = module.get<JwtService>(JwtService);

    mockedModules.bcrypt.hash = MockedBcryptHash();
    mockedModules.bcrypt.compare = MockedBcryptCompare();
  });

  afterEach(() => {
    fixtures.user = undefined;
    fixtures.username = undefined;
    fixtures.password = undefined;
    fixtures.accessToken = undefined;

    mockedModules.bcrypt.hash = undefined;
    mockedModules.bcrypt.compare = undefined;
  });

  it('service should be defiend', () => {
    expect(service).toBeDefined();
  });

  it('databaseService should be defiend', () => {
    expect(databaseService).toBeDefined();
  });

  it('jwtService should be defined', () => {
    expect(jwtService).toBeDefined();
  });

  describe('register()', () => {
    describe('with bcrypt#hash() that throws error', () => {
      it('should call bcrypt#hash() and forward error', async () => {
        fixtures.username = 'random user name';
        fixtures.password = 'random password';

        const hashError = new Error('something went wrong while hashing data');

        mockedModules.bcrypt.hash = jest.fn().mockRejectedValue(hashError);

        await expect(
          service.register(fixtures.username, fixtures.password),
        ).rejects.toThrow(hashError.message);

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, []],
          [jwtService.signAsync, []],
          [
            mockedModules.bcrypt.hash,
            [[fixtures.password, constants.bcryptHashRounds]],
          ],
          [mockedModules.bcrypt.compare, []],
        ]);
      });
    });

    describe.each([
      [null],
      [undefined],
      ['some string value'],
      [{ someKey: 'some value' }],
    ])('with databaseService#create() that returns %s', (mockedReturnValue) => {
      it('should hash password, call databaseService#create(), and return nothing', async () => {
        fixtures.username = 'random user name';
        fixtures.password = 'random password';

        databaseService.create = jest.fn().mockResolvedValue(mockedReturnValue);

        await expect(
          service.register(fixtures.username, fixtures.password),
        ).resolves.toBeUndefined();

        utils.expectMockedCalls([
          [
            databaseService.create,
            [[fixtures.username, `hashed ${fixtures.password}`]],
          ],
          [databaseService.findOne, []],
          [jwtService.signAsync, []],
          [
            mockedModules.bcrypt.hash,
            [[fixtures.password, constants.bcryptHashRounds]],
          ],
          [mockedModules.bcrypt.compare, []],
        ]);
      });
    });

    describe('with databaseService#create() that throws error', () => {
      it('should hash password, call databaseService#create(), and forward error', async () => {
        fixtures.username = 'random user name';
        fixtures.password = 'random password';

        const databaseError = new Error(
          'something went wrong while performing database operations',
        );

        databaseService.create = jest.fn().mockRejectedValue(databaseError);

        await expect(
          service.register(fixtures.username, fixtures.password),
        ).rejects.toThrow(databaseError.message);

        utils.expectMockedCalls([
          [
            databaseService.create,
            [[fixtures.username, `hashed ${fixtures.password}`]],
          ],
          [databaseService.findOne, []],
          [jwtService.signAsync, []],
          [
            mockedModules.bcrypt.hash,
            [[fixtures.password, constants.bcryptHashRounds]],
          ],
          [mockedModules.bcrypt.compare, []],
        ]);
      });
    });
  });

  describe('login()', () => {
    describe('with databaseService#findOne() that returns an account with matching password hash', () => {
      it('should call databaseService#findOne() with username, call bcrypt#compare() and return retrived access token from jwtService#signAsync()', async () => {
        fixtures.username = 'some user';
        fixtures.password = 'very secure password';

        fixtures.user = {};
        fixtures.user.id = 424;
        fixtures.user.username = fixtures.username;
        fixtures.user.password = await MockedBcryptHash()(fixtures.password);

        databaseService.findOne = jest.fn().mockResolvedValue(fixtures.user);

        fixtures.accessToken = 'generated JWT token';

        jwtService.signAsync = jest
          .fn()
          .mockResolvedValue(fixtures.accessToken);

        await expect(
          service.login(fixtures.username, fixtures.password),
        ).resolves.toStrictEqual({ access_token: fixtures.accessToken });

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, [[fixtures.username]]],
          [
            jwtService.signAsync,
            [
              [
                {
                  sub: fixtures.user.id,
                  username: fixtures.user.username,
                },
              ],
            ],
          ],
          [mockedModules.bcrypt.hash, []],
          [
            mockedModules.bcrypt.compare,
            [[fixtures.password, fixtures.user.password]],
          ],
        ]);
      });
    });

    describe('with databaseService#findOne() that returns an account with different password hash', () => {
      it('should call databaseService#findOne() with username, call bcrypt#compare() and throw UnauthorizedException', async () => {
        fixtures.username = 'some user';
        fixtures.password = 'very secure password';

        fixtures.user = {};
        fixtures.user.id = 424;
        fixtures.user.username = fixtures.username;
        fixtures.user.password = await MockedBcryptHash()(
          fixtures.password.toUpperCase(),
        );

        databaseService.findOne = jest.fn().mockResolvedValue(fixtures.user);

        await expect(
          service.login(fixtures.username, fixtures.password),
        ).rejects.toThrow(UnauthorizedException);

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, [[fixtures.username]]],
          [jwtService.signAsync, []],
          [mockedModules.bcrypt.hash, []],
          [
            mockedModules.bcrypt.compare,
            [[fixtures.password, fixtures.user.password]],
          ],
        ]);
      });
    });

    describe('with databaseService#findOne() that returns an account and bcrypt#compare() that throws error', () => {
      it('should call databaseService#findOne() with username, call bcrypt#compare() and forward error', async () => {
        fixtures.username = 'some user';
        fixtures.password = 'very secure password';

        fixtures.user = {};
        fixtures.user.id = 424;
        fixtures.user.username = fixtures.username;
        fixtures.user.password = await MockedBcryptHash()(fixtures.password);

        databaseService.findOne = jest.fn().mockResolvedValue(fixtures.user);

        const compareError = new Error(
          'something went wrong while comparing data with a hash',
        );

        mockedModules.bcrypt.compare = jest
          .fn()
          .mockRejectedValue(compareError);

        await expect(
          service.login(fixtures.username, fixtures.password),
        ).rejects.toThrow(compareError.message);

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, [[fixtures.username]]],
          [jwtService.signAsync, []],
          [mockedModules.bcrypt.hash, []],
          [
            mockedModules.bcrypt.compare,
            [[fixtures.password, fixtures.user.password]],
          ],
        ]);
      });
    });

    describe('with databaseService#findOne() that returns null', () => {
      it('should call databaseService#findOne() with username and throw UnauthorizedException', async () => {
        fixtures.username = 'random user name';
        fixtures.password = 'random password';

        databaseService.findOne = jest.fn().mockResolvedValue(null);

        await expect(
          service.login(fixtures.username, fixtures.password),
        ).rejects.toThrow(UnauthorizedException);

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, [[fixtures.username]]],
          [jwtService.signAsync, []],
          [mockedModules.bcrypt.hash, []],
          [mockedModules.bcrypt.compare, []],
        ]);
      });
    });

    describe('with databaseService#findOne() that throws error', () => {
      it('should call databaseService#findOne() with password and forward error', async () => {
        fixtures.username = 'random user name';
        fixtures.password = 'random password';

        const databaseError = new Error(
          'something went wrong while performing database operations',
        );

        databaseService.findOne = jest.fn().mockRejectedValue(databaseError);

        await expect(
          service.login(fixtures.username, fixtures.password),
        ).rejects.toThrow(databaseError.message);

        utils.expectMockedCalls([
          [databaseService.create, []],
          [databaseService.findOne, [[fixtures.username]]],
          [jwtService.signAsync, []],
          [mockedModules.bcrypt.hash, []],
          [mockedModules.bcrypt.compare, []],
        ]);
      });
    });
  });
});
