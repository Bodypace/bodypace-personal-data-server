import { TestAccount } from 'test/utils';
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';

export async function registerAccount(
  app: INestApplication,
  account: TestAccount,
) {
  await request(app!.getHttpServer())
    .post('/accounts/register')
    .send({
      username: account.username,
      password: account.password,
    })
    .expect(201)
    .expect({});
}

export async function loginAccount(
  app: INestApplication,
  account: TestAccount,
) {
  const response = await request(app!.getHttpServer())
    .post('/accounts/login')
    .send({
      username: account.username,
      password: account.password,
    })
    .expect(201);

  account.accessToken = response.body.access_token;

  expect(account.accessToken).toBeDefined();
  expect(account.accessToken!.length).toBeGreaterThan(150);
}
