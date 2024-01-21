import { TestAccount, TestDocument } from 'test/utils';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export async function uploadDocument(
  app: INestApplication,
  document: TestDocument,
  account: TestAccount,
) {
  await request(app!.getHttpServer())
    .post('/documents')
    .auth(account.accessToken!, { type: 'bearer' })
    .attach('file', document.path!)
    .field('name', document.name!)
    .field('keys', document.keys!)
    .expect(201)
    .expect({});

  document.userId = account.id;
}
