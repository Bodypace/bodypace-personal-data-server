import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { AccountsController } from './accounts.controller';
import { JwtModule } from '@nestjs/jwt';
import utils from '../../../test/utils';

const constants = {
  jwtSecret:
    'DO NOT USE THIS VALUE. INSTEAD, CREATE A COMPLEX SECRET AND KEEP IT SAFE OUTSIDE OF THE SOURCE CODE.',
};

interface Fixtures {
  credentials?: {
    username: string;
    password: string;
  };
}

function MockedAccountsService() {
  return {
    register: jest.fn(),
    login: jest.fn(),
  };
}

describe('AccountsController', () => {
  const fixtures: Fixtures = {};

  let controller: AccountsController;
  let accountsService: AccountsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          global: true,
          secret: constants.jwtSecret,
          signOptions: {
            expiresIn: '60s',
          },
        }),
      ],
      controllers: [AccountsController],
      providers: [AccountsService],
    })
      .overrideProvider(AccountsService)
      .useValue(MockedAccountsService())
      .compile();

    controller = module.get<AccountsController>(AccountsController);
    accountsService = module.get<AccountsService>(AccountsService);
  });

  afterEach(() => {
    fixtures.credentials = undefined;
  });

  it('controller should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('accountsService should be defined', () => {
    expect(accountsService).toBeDefined();
  });

  describe('register()', () => {
    describe.each([
      [undefined],
      [null],
      ['some string'],
      [{ someKey: 'some value' }],
    ])(
      'with accountsService#register() that returns %s',
      (mockedReturnValue) => {
        it('should forward call to accountsService#register() and return nothing', async () => {
          fixtures.credentials = {
            username: 'some user name',
            password: 'complex password',
          };

          accountsService.register = jest
            .fn()
            .mockResolvedValue(mockedReturnValue);

          await expect(
            controller.register(fixtures.credentials),
          ).resolves.toBeUndefined();

          utils.expectMockedCalls([
            [
              accountsService.register,
              [[fixtures.credentials.username, fixtures.credentials.password]],
            ],
            [accountsService.login, []],
          ]);
        });
      },
    );

    describe('with accountsService#register() that throws error', () => {
      it('should forward call to accountsService#register() and forward error', async () => {
        fixtures.credentials = {
          username: 'some user name',
          password: 'complex password',
        };

        const registerError = new Error(
          'something went wrong in accounts service',
        );

        accountsService.register = jest.fn().mockRejectedValue(registerError);

        await expect(controller.register(fixtures.credentials)).rejects.toThrow(
          registerError.message,
        );

        utils.expectMockedCalls([
          [
            accountsService.register,
            [[fixtures.credentials.username, fixtures.credentials.password]],
          ],
          [accountsService.login, []],
        ]);
      });
    });
  });

  describe('login()', () => {
    describe.each([
      [undefined],
      [null],
      ['some string'],
      [{ someKey: 'some value' }],
    ])('with accountsService#login() that returns %s', (mockedReturnValue) => {
      it('should forward call to accountsService#login() and forward return value', async () => {
        fixtures.credentials = {
          username: 'some user name',
          password: 'complex password',
        };

        accountsService.login = jest.fn().mockResolvedValue(mockedReturnValue);

        await expect(
          controller.login(fixtures.credentials),
        ).resolves.toStrictEqual(mockedReturnValue);

        utils.expectMockedCalls([
          [accountsService.register, []],
          [
            accountsService.login,
            [[fixtures.credentials.username, fixtures.credentials.password]],
          ],
        ]);
      });
    });

    describe('with accountsService#login() that throws error', () => {
      it('should forward call to accountsService#login() and forward error', async () => {
        fixtures.credentials = {
          username: 'some user name',
          password: 'complex password',
        };

        const loginError = new Error(
          'something went wrong in accounts service',
        );

        accountsService.login = jest.fn().mockRejectedValue(loginError);

        await expect(controller.login(fixtures.credentials)).rejects.toThrow(
          loginError.message,
        );

        utils.expectMockedCalls([
          [accountsService.register, []],
          [
            accountsService.login,
            [[fixtures.credentials.username, fixtures.credentials.password]],
          ],
        ]);
      });
    });
  });

  describe('getProfile()', () => {
    it('TODO', () => {});

    it('should return user object attached to request by AuthGuard', async () => {
      const request = {
        user: 'something',
        otherData: {
          thisWill: 'beIgnored',
        },
      };

      expect(controller.getProfile(request)).toStrictEqual(request.user);

      utils.expectMockedCalls([
        [accountsService.register, []],
        [accountsService.login, []],
      ]);
    });
  });
});
