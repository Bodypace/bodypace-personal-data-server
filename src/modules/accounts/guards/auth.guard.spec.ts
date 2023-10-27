import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { HttpArgumentsHost } from '@nestjs/common/interfaces';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';
import utils from '../../../../test/utils';

const constants = {
  jwtSecretEnvKey: 'BODYPACE_SERVER_JWT_SECRET',
};

function MockedJwtService(): JwtService {
  const mock = new JwtService();
  jest.spyOn(mock, 'sign').mockImplementation();
  jest.spyOn(mock, 'signAsync').mockImplementation();
  jest.spyOn(mock, 'verify').mockImplementation();
  jest.spyOn(mock, 'verifyAsync').mockImplementation();
  jest.spyOn(mock, 'decode').mockImplementation();
  return mock;
}

function MockedHttpArgumentsHost(): HttpArgumentsHost {
  return {
    getRequest: jest.fn(),
    getResponse: jest.fn(),
    getNext: jest.fn(),
  };
}

function MockedExecutionContext(
  mockedHttpArgumentsHost: HttpArgumentsHost,
): ExecutionContext {
  return {
    getArgs: jest.fn(),
    getArgByIndex: jest.fn(),
    switchToRpc: jest.fn(),
    switchToHttp: jest.fn().mockImplementation(() => mockedHttpArgumentsHost),
    switchToWs: jest.fn(),
    getType: jest.fn(),
    getClass: jest.fn(),
    getHandler: jest.fn(),
  };
}

interface Fixtures {
  token?: string;
  tokenPayload?: any;
  request?: any;
  jwtSecret?: string;
}

interface Mocks {
  jwtService?: JwtService;
  httpArgumentsHost?: HttpArgumentsHost;
  executionContext?: ExecutionContext;
}

describe('AuthGuard', () => {
  const fixtures: Fixtures = {};
  const mocks: Mocks = {};

  let guard: AuthGuard | undefined;

  beforeEach(() => {
    mocks.jwtService = MockedJwtService();
    mocks.httpArgumentsHost = MockedHttpArgumentsHost();
    mocks.executionContext = MockedExecutionContext(mocks.httpArgumentsHost);

    guard = new AuthGuard(mocks.jwtService);
  });

  afterEach(() => {
    mocks.jwtService = undefined;
    mocks.httpArgumentsHost = undefined;
    mocks.executionContext = undefined;

    guard = undefined;

    fixtures.token = undefined;
    fixtures.tokenPayload = undefined;
    fixtures.request = undefined;
    fixtures.jwtSecret = undefined;

    process.env[constants.jwtSecretEnvKey] = undefined;
  });

  it('guard should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('mocks should be defined', () => {
    expect(mocks.jwtService).toBeDefined();
    expect(mocks.httpArgumentsHost).toBeDefined();
    expect(mocks.executionContext).toBeDefined();
  });

  describe('canActivate()', () => {
    describe('for request with valid Authorization header', () => {
      beforeEach(() => {
        fixtures.token = 'this-string-represents-token-value';
        fixtures.request = {
          headers: {
            authorization: 'Bearer ' + fixtures.token,
          },
        };
        fixtures.jwtSecret = 'random complex and long JWT secret';
      });

      describe('with JwtService#varifyAsync() that passes', () => {
        it('should extract token from HTTP request, fetch JWT secret from env, verify token with JwtService#verifyAsync(), assign token payload to request["user"] and return true', async () => {
          fixtures.tokenPayload = {
            keyNo1: 'some value',
            keyNo2: 'some value again',
          };

          process.env[constants.jwtSecretEnvKey] = fixtures.jwtSecret;

          mocks.httpArgumentsHost!.getRequest = jest
            .fn()
            .mockReturnValue(fixtures.request);

          mocks.jwtService!.verifyAsync = jest
            .fn()
            .mockResolvedValue(fixtures.tokenPayload);

          const originalRequest = structuredClone(fixtures.request);
          expect(originalRequest).toEqual(fixtures.request);
          expect(originalRequest.user).toBeUndefined();
          expect(fixtures.request.user).toBeUndefined();

          await expect(
            guard!.canActivate(mocks.executionContext!),
          ).resolves.toBeTruthy();

          expect(originalRequest).not.toEqual(fixtures.request);
          expect(originalRequest.user).toBeUndefined();
          expect(fixtures.request.user).not.toBeUndefined();

          expect(fixtures.request).toEqual({
            ...originalRequest,
            user: fixtures.tokenPayload,
          });

          utils.expectMockedCalls([
            [mocks.executionContext!.switchToHttp, [[]]],
            [mocks.executionContext!.getArgs, []],
            [mocks.executionContext!.getArgByIndex, []],
            [mocks.executionContext!.switchToRpc, []],
            [mocks.executionContext!.switchToWs, []],
            [mocks.executionContext!.getType, []],
            [mocks.executionContext!.getClass, []],
            [mocks.executionContext!.getHandler, []],

            [mocks.httpArgumentsHost!.getRequest, [[]]],
            [mocks.httpArgumentsHost!.getResponse, []],
            [mocks.httpArgumentsHost!.getNext, []],

            [mocks.jwtService!.sign, []],
            [mocks.jwtService!.signAsync, []],
            [mocks.jwtService!.verify, []],
            [
              mocks.jwtService!.verifyAsync,
              [[fixtures.token, { secret: fixtures.jwtSecret }]],
            ],
            [mocks.jwtService!.decode, []],
          ]);
        });
      });

      describe('with JwtService#verifyAsync() that fails', () => {
        it('should extract token from HTTP request, fetch JWT secret from env, verify token with JwtService#verifyAsync() and throw UnauthorizedException', async () => {
          process.env[constants.jwtSecretEnvKey] = fixtures.jwtSecret;

          mocks.httpArgumentsHost!.getRequest = jest
            .fn()
            .mockReturnValue(fixtures.request);

          mocks.jwtService!.verifyAsync = jest
            .fn()
            .mockRejectedValue(new Error('something is wrong'));

          await expect(
            guard!.canActivate(mocks.executionContext!),
          ).rejects.toThrow(UnauthorizedException);

          utils.expectMockedCalls([
            [mocks.executionContext!.switchToHttp, [[]]],
            [mocks.executionContext!.getArgs, []],
            [mocks.executionContext!.getArgByIndex, []],
            [mocks.executionContext!.switchToRpc, []],
            [mocks.executionContext!.switchToWs, []],
            [mocks.executionContext!.getType, []],
            [mocks.executionContext!.getClass, []],
            [mocks.executionContext!.getHandler, []],

            [mocks.httpArgumentsHost!.getRequest, [[]]],
            [mocks.httpArgumentsHost!.getResponse, []],
            [mocks.httpArgumentsHost!.getNext, []],

            [mocks.jwtService!.sign, []],
            [mocks.jwtService!.signAsync, []],
            [mocks.jwtService!.verify, []],
            [
              mocks.jwtService!.verifyAsync,
              [[fixtures.token, { secret: fixtures.jwtSecret }]],
            ],
            [mocks.jwtService!.decode, []],
          ]);
        });
      });
    });

    describe.each([
      [
        'invalid Authorization header - not "Bearer"',
        {
          authorization: 'bearer random-token-value',
        },
      ],
      [
        'invalid Authorization header - missing token',
        {
          authorization: 'Bearer',
        },
      ],
      [
        'invalid Authorization header - missing "Bearer"',
        {
          authorization: 'random-token-value',
        },
      ],
      [
        'invalid Authorization header - empty string',
        {
          authorization: '',
        },
      ],
      ['no Authorization header', {}],
    ])('for request with %s', (_, invalidHeaders) => {
      it('should extract token from HTTP request and throw UnauthorizedException', async () => {
        fixtures.request = {
          headers: invalidHeaders,
        };

        mocks.httpArgumentsHost!.getRequest = jest
          .fn()
          .mockReturnValue(fixtures.request);

        await expect(
          guard!.canActivate(mocks.executionContext!),
        ).rejects.toThrow(UnauthorizedException);

        utils.expectMockedCalls([
          [mocks.executionContext!.switchToHttp, [[]]],
          [mocks.executionContext!.getArgs, []],
          [mocks.executionContext!.getArgByIndex, []],
          [mocks.executionContext!.switchToRpc, []],
          [mocks.executionContext!.switchToWs, []],
          [mocks.executionContext!.getType, []],
          [mocks.executionContext!.getClass, []],
          [mocks.executionContext!.getHandler, []],

          [mocks.httpArgumentsHost!.getRequest, [[]]],
          [mocks.httpArgumentsHost!.getResponse, []],
          [mocks.httpArgumentsHost!.getNext, []],

          [mocks.jwtService!.sign, []],
          [mocks.jwtService!.signAsync, []],
          [mocks.jwtService!.verify, []],
          [mocks.jwtService!.verifyAsync, []],
          [mocks.jwtService!.decode, []],
        ]);
      });
    });
  });
});
