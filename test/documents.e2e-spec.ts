import { constants } from './utilities/constants';

process.env[constants.jwtSecretEnvKey] =
  'SOME COMPLEX LONG RANDOM SEQUENCE THAT NOBODY CAN KNOW';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import utils from './utils';
import type { TestDocument, TestAccount } from './utils';
import { uploadDocument } from './utilities/documents';
import { registerAccount, loginAccount } from './utilities/accounts';
import { OK, MISSING, reqAttach, reqField } from './utilities/request';

// https://stackoverflow.com/questions/71898429/typescript-function-argument-generics
function eachIf<T extends readonly unknown[]>(
  condition: boolean,
  options: readonly T[],
): readonly T[] {
  if (condition) {
    return options;
  }
  return [];
}

interface Helpers {
  expectDatabaseWasNotAltered?: () => Promise<void>;
}

interface Fixtures {
  existing: {
    account: TestAccount;
    account_2: TestAccount;
    document: TestDocument;
    document_2: TestDocument;
    document_3: TestDocument;
  };

  new: {
    document: TestDocument;
  };

  firstDocument: TestDocument;
  secondDocument: TestDocument;
}

describe('DocumentsController (e2e)', () => {
  const fixtures: Fixtures = {
    existing: {
      account: {},
      account_2: {},
      document: {},
      document_2: {},
      document_3: {},
    },
    new: {
      document: {},
    },
    firstDocument: {},
    secondDocument: {},
  };

  const helpers: Helpers = {};

  let app: INestApplication | undefined;
  let dataSource: DataSource | undefined;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized) {
      await dataSource!.destroy();
    }

    await rm(constants.databaseDir, { recursive: true });
    await mkdir(constants.databaseDir);
    await writeFile(constants.databasePath, '');
    await mkdir(constants.databaseDocumentsDir);

    fixtures.existing.account = {};
    fixtures.existing.account_2 = {};

    fixtures.existing.document = {};
    fixtures.existing.document_2 = {};
    fixtures.existing.document_3 = {};

    fixtures.new.document = {};

    fixtures.firstDocument = {};
    fixtures.secondDocument = {};

    helpers.expectDatabaseWasNotAltered = undefined;

    app = undefined;
    dataSource = undefined;
  });

  it('dataSource should be defined', () => {
    expect(dataSource).toBeDefined();
  });

  describe('/documents', () => {
    // TODO: test / HEAD
    // TODO: test /:id HEAD

    describe('POST /', () => {
      describe.each([
        ['that stores 1 account and 0 documents', false],
        ['that stores 1 account and 1 document', true],
      ])('with database %s', (_, databaseShouldContainDocument) => {
        beforeEach(async () => {
          fixtures.existing.account.id = 1;
          fixtures.existing.account.username = 'first account username';
          fixtures.existing.account.password = 'first account password';

          await registerAccount(app!, fixtures.existing.account);
          await loginAccount(app!, fixtures.existing.account);

          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'first-uploaded-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';
          fixtures.firstDocument.userId = fixtures.existing.account.id;

          if (databaseShouldContainDocument) {
            await uploadDocument(
              app!,
              fixtures.firstDocument,
              fixtures.existing.account,
            );
          }

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'second-uploaded-file.md';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.userId = fixtures.existing.account.id;

          // new code
          fixtures.existing.document.id = fixtures.firstDocument.id;
          fixtures.existing.document.name = fixtures.firstDocument.name;
          fixtures.existing.document.path = fixtures.firstDocument.path;
          fixtures.existing.document.keys = fixtures.firstDocument.keys;
          fixtures.existing.document.userId = fixtures.existing.account.id;

          if (databaseShouldContainDocument) {
            fixtures.new.document.id = fixtures.secondDocument.id;
            fixtures.new.document.name = fixtures.secondDocument.name;
            fixtures.new.document.path = fixtures.secondDocument.path;
            fixtures.new.document.keys = fixtures.secondDocument.keys;
            fixtures.new.document.userId = fixtures.secondDocument.userId;
          } else {
            fixtures.new.document.id = fixtures.firstDocument.id;
            fixtures.new.document.name = fixtures.firstDocument.name;
            fixtures.new.document.path = fixtures.firstDocument.path;
            fixtures.new.document.keys = fixtures.firstDocument.keys;
            fixtures.new.document.userId = fixtures.firstDocument.userId;
          }
        });

        describe.each([
          ['available', true],
          ['not available', false],
        ])('with database %s', (_, databaseShouldBeAvailable) => {
          beforeEach(async () => {
            if (!databaseShouldBeAvailable) {
              await dataSource!.destroy();
            }

            helpers.expectDatabaseWasNotAltered = async () => {
              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocument
                  ? [fixtures.existing.document]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            };
          });

          // NOTE: maybe 503 would be better but MDN says it needs a few extra things
          // that I don't want to implement and feel are not crucial for now.
          describe(
            databaseShouldBeAvailable
              ? 'should 201, store document in database and return nothing'
              : 'should 500, not alter database and return message that explains error cause',
            () => {
              it.each([
                ['for request that is correct', false],
                ...eachIf(databaseShouldContainDocument, [
                  [
                    'for request that is correct - same file, keys and user again',
                    true,
                  ],
                ]),
              ])('%s', async (_, sameFileAndKey: boolean) => {
                // TODO: When same file is uploaded twice (possibly under different name),
                // that file should be shared/reused to save space.
                if (sameFileAndKey) {
                  fixtures.new.document.path = fixtures.existing.document.path;
                  fixtures.new.document.keys = fixtures.existing.document.keys;
                }

                await request(app!.getHttpServer())
                  .post('/documents')
                  .auth(fixtures.existing.account.accessToken!, {
                    type: 'bearer',
                  })
                  .attach('file', fixtures.new.document.path!)
                  .field('name', fixtures.new.document.name!)
                  .field('keys', fixtures.new.document.keys!)
                  .expect(databaseShouldBeAvailable ? 201 : 500)
                  .expect(
                    databaseShouldBeAvailable
                      ? {}
                      : {
                          statusCode: 500,
                          error: 'Internal Server Error',
                          message:
                            'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                        },
                  );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocument
                    ? databaseShouldBeAvailable
                      ? [fixtures.existing.document, fixtures.new.document]
                      : [fixtures.existing.document]
                    : databaseShouldBeAvailable
                    ? [fixtures.new.document]
                    : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            },
          );

          describe('should 401, not alter database and return message that explains error cause', () => {
            it.each([
              ['for request with no authorization header', false],
              ['for request with invalid authorization header', true],
            ])('%s', async (_, invalidAuthorizationHeader: boolean) => {
              let req = request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.new.document.path!)
                .field('name', fixtures.new.document.name!)
                .field('keys', fixtures.new.document.keys!);

              if (invalidAuthorizationHeader) {
                req = req.auth('invalid-token', { type: 'bearer' });
              }

              await req.expect(401).expect({
                message: 'Unauthorized',
                statusCode: 401,
              });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe('should 400, not alter database and return message that explains error cause', () => {
            // TODO: test multiple files being attached/uploaded (under same name or few different at once)

            // TODO: we could check that `keys` has decent size and a JSON structure and maybe something else.
            // It will not prevent 3rd party clients/frontends from incorrectly using this field but
            // at least most obvious errors will be catched.

            it.each([
              ['with "name" field mispelled as "Name"', 'name', 'Name'],
              ['with "name" field mispelled as "NAME"', 'name', 'NAME'],
              ['with "name" field missing', 'name', MISSING],
              ['with "name" field value empty', 'name', OK, ''],
              ['with "keys" field mispelled as "Keys"', 'keys', 'Keys'],
              ['with "keys" field mispelled as "KEYS"', 'keys', 'KEYS'],
              ['with "keys" field missing', 'keys', MISSING],
              ['with "keys" field value empty', 'keys', OK, ''],
              ['with "file" field mispelled as "File"', 'file', 'File'],
              ['with "file" field mispelled as "FILE"', 'file', 'FILE'],
              [
                'with "file" field missing (no file attached/uploading)',
                'file',
                MISSING,
              ],
              [
                'with "file" field uploading empty file',
                'file',
                OK,
                constants.testDocument.empty.path,
              ],
            ])(
              'for request %s',
              async (
                _,
                fieldName: string,
                newFieldName: string | typeof MISSING | typeof OK,
                newFieldValue: string | typeof OK = OK,
              ) => {
                // req = req.attach('file', fixtures.new.document.path!);
                let req = request(app!.getHttpServer())
                  .post('/documents')
                  .auth(fixtures.existing.account.accessToken!, {
                    type: 'bearer',
                  });
                req = reqAttach(req, 'file', fixtures.new.document.path!, {
                  triggerName: fieldName,
                  replacementName: newFieldName,
                  replacementValue: newFieldValue,
                });
                req = reqField(req, 'name', fixtures.new.document.name!, {
                  triggerName: fieldName,
                  replacementName: newFieldName,
                  replacementValue: newFieldValue,
                });
                req = reqField(req, 'keys', fixtures.new.document.keys!, {
                  triggerName: fieldName,
                  replacementName: newFieldName,
                  replacementValue: newFieldValue,
                });

                //prettier-ignore
                const message =
                  fieldName === 'file' ? 
                    newFieldValue === constants.testDocument.empty.path ?
                      'Uploaded file cannot be empty' :
                    newFieldName === MISSING ?
                      'Missing `file` field that should upload file' :
                      'Unexpected field' : // TODO: this is bad, the error should be more descriptive
                  newFieldName ? [
                    `property ${newFieldName} should not exist`,
                    `${fieldName} should not be empty`,
                    `${fieldName} must be a string`,
                  ] :
                  newFieldName === MISSING ? [
                    `${fieldName} should not be empty`,
                    `${fieldName} must be a string`,
                  ] :
                  newFieldName === OK && newFieldValue === '' ? [
                    `${fieldName} should not be empty`,
                  ] : [
                    'test should not reach this point'
                  ]

                expect(['name', 'keys', 'file']).toContain(fieldName);
                expect(message[0]).not.toBe('test should not reach this point');

                await req.expect(400).expect({
                  message,
                  error: 'Bad Request',
                  statusCode: 400,
                });

                await helpers.expectDatabaseWasNotAltered!();
              },
            );

            it('for request with "file" field that is not a file', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .auth(fixtures.existing.account.accessToken!, {
                  type: 'bearer',
                })
                .field(
                  'file',
                  'some random text content, lets say someone sent text file content instead of uploading the text file',
                )
                .field('name', fixtures.secondDocument.name!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(400)
                .expect({
                  // TODO: message could be more descriptive, now it can be misleading or confusing
                  message: ['property file should not exist'],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });

            it.each([['Field'], ['key'], ['type'], [' ']])(
              'for request with additional unknown field `%s`',
              async (additionalUnknownField) => {
                await request(app!.getHttpServer())
                  .post('/documents')
                  .auth(fixtures.existing.account.accessToken!, {
                    type: 'bearer',
                  })
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .field(additionalUnknownField, 'some random value')
                  .expect(400)
                  .expect({
                    message: [
                      `property ${additionalUnknownField} should not exist`,
                    ],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await helpers.expectDatabaseWasNotAltered!();
              },
            );

            it('for request with Content-Type application/json and "file" field', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .auth(fixtures.existing.account.accessToken!, {
                  type: 'bearer',
                })
                .send({
                  name: fixtures.secondDocument.name,
                  file: 'preasumebly file content here as a text',
                  keys: fixtures.secondDocument.keys,
                })
                .set('Content-Type', 'application/json')
                .expect(400)
                .expect({
                  // TODO: message could be more descriptive, now it can be misleading or confusing
                  // it could explain that we expect multipart/form-data, also 400 is maybe not the best code
                  message: ['property file should not exist'],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe('should 415, not alter database and return message that explains error cause', () => {
            it('for request with Content-Type application/json and no "file" field', async () => {
              const wrongContentType = 'application/json';
              await request(app!.getHttpServer())
                .post('/documents')
                .auth(fixtures.existing.account.accessToken!, {
                  type: 'bearer',
                })
                .send({
                  name: fixtures.secondDocument.name,
                  keys: fixtures.secondDocument.keys,
                })
                .set('Content-Type', wrongContentType)
                .expect(415)
                .expect({
                  message: `Unsupported media type (Content-Type): ${wrongContentType}`,
                  error: 'Unsupported Media Type',
                  statusCode: 415,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });
        });
      });
    });

    describe('POST /:id', () => {
      describe('with database that is empty', () => {
        describe('with database available', () => {
          describe('should 404, not alter database and return message that explains error cause ', () => {
            it('for request that is correct', async () => {
              fixtures.firstDocument.name = 'my-uploaded-file.pdf';
              fixtures.firstDocument.path = constants.testDocument.pdf.path;
              fixtures.firstDocument.keys = 'aaaa-bbbb-cccc-dddd';

              await request(app!.getHttpServer())
                .post('/documents/1')
                .attach('file', fixtures.firstDocument.path)
                .field('name', fixtures.firstDocument.name)
                .field('keys', fixtures.firstDocument.keys)
                .expect(404)
                .expect({
                  message: 'Cannot POST /documents/1',
                  error: 'Not Found',
                  statusCode: 404,
                });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                [],
                true,
                dataSource!,
              );
            });
          });
        });
      });
    });

    describe('GET /', () => {
      describe.each([
        ['that stores 2 accounts and 0 documents', false],
        ['that stores 2 accounts and 3 documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments) => {
        beforeEach(async () => {
          fixtures.existing.account.id = 1;
          fixtures.existing.account.username = 'first account username';
          fixtures.existing.account.password = 'first account password';

          fixtures.existing.account_2.id = 2;
          fixtures.existing.account_2.username = 'second account username';
          fixtures.existing.account_2.password = 'second account password';

          await registerAccount(app!, fixtures.existing.account);
          await loginAccount(app!, fixtures.existing.account);

          await registerAccount(app!, fixtures.existing.account_2);
          await loginAccount(app!, fixtures.existing.account_2);

          fixtures.existing.document.id = 1;
          fixtures.existing.document.name = 'first-uploaded-file.pdf';
          fixtures.existing.document.path = constants.testDocument.pdf.path;
          fixtures.existing.document.keys = 'first-file-keys';

          fixtures.existing.document_2.id = 2;
          fixtures.existing.document_2.name = 'second-uploaded-file.pdf';
          fixtures.existing.document_2.path =
            constants.testDocument.markdown.path;
          fixtures.existing.document_2.keys = 'second-file-keys';

          fixtures.existing.document_3.id = 3;
          fixtures.existing.document_3.name = 'third-uploaded-file.pdf';
          fixtures.existing.document_3.path = constants.testDocument.pdf.path;
          fixtures.existing.document_3.keys = 'third-file-keys';

          if (databaseShouldContainDocuments) {
            await uploadDocument(
              app!,
              fixtures.existing.document,
              fixtures.existing.account,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_2,
              fixtures.existing.account_2,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_3,
              fixtures.existing.account,
            );
          }
        });

        describe.each([
          ['available', true],
          ['not available', false],
        ])('with database %s', (_, databaseShouldBeAvailable) => {
          beforeEach(async () => {
            if (!databaseShouldBeAvailable) {
              await dataSource!.destroy();
            }
          });

          describe(
            databaseShouldBeAvailable
              ? 'should 200, not alter database and return list of documents'
              : 'should 500, not alter database and return message that explains error cause',
            () => {
              it.each([
                ['first account', true],
                ['second account', false],
              ])(
                'for request that is correct - %s',
                async (_, firstAccount) => {
                  const docInfo = (doc: TestDocument) => ({
                    id: doc.id,
                    name: doc.name,
                    keys: doc.keys,
                    userId: doc.userId,
                  });

                  const account = firstAccount
                    ? fixtures.existing.account
                    : fixtures.existing.account_2;

                  await request(app!.getHttpServer())
                    .get('/documents')
                    .auth(account.accessToken!, {
                      type: 'bearer',
                    })
                    .expect(databaseShouldBeAvailable ? 200 : 500)
                    .expect(
                      databaseShouldBeAvailable
                        ? databaseShouldContainDocuments
                          ? firstAccount
                            ? [
                                docInfo(fixtures.existing.document),
                                docInfo(fixtures.existing.document_3),
                              ]
                            : [docInfo(fixtures.existing.document_2)]
                          : []
                        : {
                            message:
                              'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                            error: 'Internal Server Error',
                            statusCode: 500,
                          },
                    );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    databaseShouldContainDocuments
                      ? [
                          fixtures.existing.document,
                          fixtures.existing.document_2,
                          fixtures.existing.document_3,
                        ]
                      : [],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                },
              );
            },
          );

          describe('should 401, not alter database and return message that explains error cause', () => {
            it.each([
              ['for request with no authorization header', false],
              ['for request with invalid authorization header', true],
            ])('%s', async (_, invalidAuthorizationHeader) => {
              let req = request(app!.getHttpServer()).get('/documents');

              if (invalidAuthorizationHeader) {
                req = req.auth('invalid-token', { type: 'bearer' });
              }

              await req.expect(401).expect({
                message: 'Unauthorized',
                statusCode: 401,
              });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        });
      });
    });

    describe('GET /:id', () => {
      describe.each([
        ['that stores 2 accounts and 0 documents', false],
        ['that stores 2 accounts and 3 documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          fixtures.existing.account.id = 1;
          fixtures.existing.account.username = 'first account username';
          fixtures.existing.account.password = 'first account password';

          fixtures.existing.account_2.id = 2;
          fixtures.existing.account_2.username = 'second account username';
          fixtures.existing.account_2.password = 'second account password';

          await registerAccount(app!, fixtures.existing.account);
          await loginAccount(app!, fixtures.existing.account);

          await registerAccount(app!, fixtures.existing.account_2);
          await loginAccount(app!, fixtures.existing.account_2);

          fixtures.existing.document.id = 1;
          fixtures.existing.document.name = 'first-uploaded-file.pdf';
          fixtures.existing.document.path = constants.testDocument.pdf.path;
          fixtures.existing.document.keys = 'first-file-keys';

          fixtures.existing.document_2.id = 2;
          fixtures.existing.document_2.name = 'second-uploaded-file.pdf';
          fixtures.existing.document_2.path =
            constants.testDocument.markdown.path;
          fixtures.existing.document_2.keys = 'second-file-keys';

          fixtures.existing.document_3.id = 3;
          fixtures.existing.document_3.name = 'third-uploaded-file.pdf';
          fixtures.existing.document_3.path = constants.testDocument.pdf.path;
          fixtures.existing.document_3.keys = 'third-file-keys';

          if (databaseShouldContainDocuments) {
            await uploadDocument(
              app!,
              fixtures.existing.document,
              fixtures.existing.account,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_2,
              fixtures.existing.account_2,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_3,
              fixtures.existing.account,
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

          if (databaseShouldContainDocuments) {
            describe(
              databaseShouldBeAvailable
                ? 'should 200, not alter database and download correct document'
                : 'should 500, not alter database and return message that explains error cause',
              () => {
                it.each([
                  ['correct - first document id', 1],
                  ['correct - first document id technically', '001'],
                  ['correct - second document id', 3],
                ])('for request that is %s - %s', async (_, documentId) => {
                  const req = request(app!.getHttpServer())
                    .get(`/documents/${documentId}`)
                    .auth(fixtures.existing.account.accessToken!, {
                      type: 'bearer',
                    });

                  if (databaseShouldBeAvailable) {
                    let data = '';
                    const response = await req
                      .buffer()
                      .parse((res, callback) => {
                        res.setEncoding('binary');
                        data = '';
                        res.on('data', (chunk) => {
                          data += chunk;
                        });
                        res.on('end', () => {
                          callback(null, Buffer.from(data, 'binary'));
                        });
                      });

                    expect(response.statusCode).toBe(200);

                    const document =
                      Number(documentId) === fixtures.existing.document.id
                        ? fixtures.existing.document
                        : fixtures.existing.document_3;

                    await expect(
                      utils.fileEquals(
                        `${constants.databaseDocumentsDir}/${document.userId}/${document.name}`,
                        response.body,
                      ),
                    ).resolves.toBeTruthy();
                  } else {
                    await req.expect(500).expect({
                      message:
                        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                      error: 'Internal Server Error',
                      statusCode: 500,
                    });
                  }

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              },
            );
          }

          describe(
            databaseShouldBeAvailable
              ? 'should 404, not alter database and return message that explains error cause'
              : 'should 500, not alter database and return message that explains error cause',
            () => {
              it.each([
                ['for request with unknown document id', 4],
                ['for request with negative number document id', -1],
                ['for request with 0 as document id (we count from 1)', 0],
              ])('%s - %s', async (_, incorrectDocumentId: number | string) => {
                await request(app!.getHttpServer())
                  .get(`/documents/${incorrectDocumentId}`)
                  .auth(fixtures.existing.account.accessToken!, {
                    type: 'bearer',
                  })
                  .expect(databaseShouldBeAvailable ? 404 : 500)
                  .expect(
                    databaseShouldBeAvailable
                      ? {
                          message: 'Not Found',
                          statusCode: 404,
                        }
                      : {
                          message:
                            'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                          error: 'Internal Server Error',
                          statusCode: 500,
                        },
                  );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [
                        fixtures.existing.document,
                        fixtures.existing.document_2,
                        fixtures.existing.document_3,
                      ]
                    : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });

              if (databaseShouldContainDocuments) {
                it('for request with document id that does not belong to user', async () => {
                  expect(fixtures.existing.document_2.userId).not.toBe(
                    fixtures.existing.account.id,
                  );
                  expect(fixtures.existing.document_2.userId).toBe(
                    fixtures.existing.account_2.id,
                  );

                  await request(app!.getHttpServer())
                    .get(`/documents/${fixtures.existing.document_2.id}`)
                    .auth(fixtures.existing.account.accessToken!, {
                      type: 'bearer',
                    })
                    .expect(databaseShouldBeAvailable ? 404 : 500)
                    .expect(
                      // message: 'Unauthorized',
                      // statusCode: 401,
                      databaseShouldBeAvailable
                        ? {
                            message: 'Not Found',
                            statusCode: 404,
                          }
                        : {
                            message:
                              'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                            error: 'Internal Server Error',
                            statusCode: 500,
                          },
                    );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ],
                    databaseShouldBeAvailable,
                    dataSource!,
                  );
                });
              }
            },
          );

          describe('should 401, not alter database and return message that explains error cause', () => {
            it.each([
              ['for request with no authorization header', false],
              ['for request with invalid authorization header', true],
            ])('%s', async (_, invalidAuthorizationHeader) => {
              let req = request(app!.getHttpServer()).get(
                `/documents/${fixtures.existing.document.id}`,
              );

              if (invalidAuthorizationHeader) {
                req = req.auth('invalid-token', { type: 'bearer' });
              }

              await req.expect(401).expect({
                message: 'Unauthorized',
                statusCode: 401,
              });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });

          describe('should 400, not alter database and return message that explains error cause', () => {
            it.each([
              ['string as id', 'A'],
              ['floating point number as id', '1.0'],
              ['floating point number as id', '1.1'],
              ['floating point number as id', '3.0'],
            ])('for request with %s - %s', async (_, incorrectId) => {
              await request(app!.getHttpServer())
                .get(`/documents/${incorrectId}`)
                .auth(fixtures.existing.account.accessToken!, {
                  type: 'bearer',
                })
                .expect(400)
                .expect({
                  // TODO: message could be more descriptive by explicitly stating that we mean :id param in URL
                  message: 'Validation failed (numeric string is expected)',
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        });
      });
    });

    // TODO: test that UPDATE / & /:id does not work
    // TODO: test that PATCH  / & /:id does not work

    describe('DELETE /', () => {
      describe.each([
        ['that is empty', false],
        ['that already stores two documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          fixtures.existing.account.id = 1;
          fixtures.existing.account.username = 'first account username';
          fixtures.existing.account.password = 'first account password';

          await registerAccount(app!, fixtures.existing.account);
          await loginAccount(app!, fixtures.existing.account);

          fixtures.existing.document.id = 1;
          fixtures.existing.document.name = 'first-uploaded-file.pdf';
          fixtures.existing.document.path = constants.testDocument.pdf.path;
          fixtures.existing.document.keys = 'first-file-keys';

          fixtures.existing.document_2.id = 2;
          fixtures.existing.document_2.name = 'second-uploaded-file.pdf';
          fixtures.existing.document_2.path =
            constants.testDocument.markdown.path;
          fixtures.existing.document_2.keys = 'second-file-keys';

          if (databaseShouldContainDocuments) {
            await uploadDocument(
              app!,
              fixtures.existing.document,
              fixtures.existing.account,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_2,
              fixtures.existing.account,
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

          describe('for request that is correct', () => {
            it('should 404, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .delete('/documents')
                .expect(404)
                .expect({
                  // TODO: this message could be more descriptive by explaining that document id is required
                  message: 'Cannot DELETE /documents',
                  error: 'Not Found',
                  statusCode: 404,
                });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [fixtures.existing.document, fixtures.existing.document_2]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        });
      });
    });

    describe('DELETE /:id', () => {
      // TODO: all correct responses should use code 204, not 200
      // https://stackoverflow.com/questions/2342579/http-status-code-for-update-and-delete
      // NOTE: for other endpoints if those do not return data no 200, 204 should probably be used aswell.

      describe.each([
        ['that stores 2 accounts and 0 documents', false],
        ['that stores 2 accounts and 3 documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          fixtures.existing.account.id = 1;
          fixtures.existing.account.username = 'first account username';
          fixtures.existing.account.password = 'first account password';

          fixtures.existing.account_2.id = 2;
          fixtures.existing.account_2.username = 'second account username';
          fixtures.existing.account_2.password = 'second account password';

          await registerAccount(app!, fixtures.existing.account);
          await loginAccount(app!, fixtures.existing.account);

          await registerAccount(app!, fixtures.existing.account_2);
          await loginAccount(app!, fixtures.existing.account_2);

          fixtures.existing.document.id = 1;
          fixtures.existing.document.name = 'first-uploaded-file.pdf';
          fixtures.existing.document.path = constants.testDocument.pdf.path;
          fixtures.existing.document.keys = 'first-file-keys';

          fixtures.existing.document_2.id = 2;
          fixtures.existing.document_2.name = 'second-uploaded-file.pdf';
          fixtures.existing.document_2.path =
            constants.testDocument.markdown.path;
          fixtures.existing.document_2.keys = 'second-file-keys';

          fixtures.existing.document_3.id = 3;
          fixtures.existing.document_3.name = 'third-uploaded-file.pdf';
          fixtures.existing.document_3.path = constants.testDocument.pdf.path;
          fixtures.existing.document_3.keys = 'third-file-keys';

          if (databaseShouldContainDocuments) {
            await uploadDocument(
              app!,
              fixtures.existing.document,
              fixtures.existing.account,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_2,
              fixtures.existing.account_2,
            );

            await uploadDocument(
              app!,
              fixtures.existing.document_3,
              fixtures.existing.account,
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

          if (databaseShouldContainDocuments) {
            describe(
              databaseShouldBeAvailable
                ? 'should 200, remove only mentioned document from database and return nothing'
                : 'should 500, not alter database and return message that explains error cause',
              () => {
                it.each([[1], [3]])(
                  'for request with known document id - %s',
                  async (documentId) => {
                    await request(app!.getHttpServer())
                      .delete(`/documents/${documentId}`)
                      .auth(fixtures.existing.account.accessToken!, {
                        type: 'bearer',
                      })
                      .expect(databaseShouldBeAvailable ? 200 : 500)
                      .expect(
                        databaseShouldBeAvailable
                          ? {}
                          : {
                              message:
                                'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                              error: 'Internal Server Error',
                              statusCode: 500,
                            },
                      );

                    const remainingDocuments =
                      documentId === fixtures.existing.document.id
                        ? [
                            fixtures.existing.document_2,
                            fixtures.existing.document_3,
                          ]
                        : [
                            fixtures.existing.document,
                            fixtures.existing.document_2,
                          ];

                    await utils.expectDatabaseDocumentsState(
                      constants.databasePath,
                      constants.databaseDocumentsDir,
                      databaseShouldBeAvailable
                        ? remainingDocuments
                        : [
                            fixtures.existing.document,
                            fixtures.existing.document_2,
                            fixtures.existing.document_3,
                          ],
                      databaseShouldBeAvailable,
                      dataSource!,
                    );
                  },
                );
              },
            );
          }

          describe(
            databaseShouldBeAvailable
              ? 'should 200, not alter database and return nothing'
              : 'should 500, not alter database and return message that explains error cause',
            () => {
              it.each([
                ['unknown document id', 4],
                ...eachIf(databaseShouldContainDocuments, [
                  ['document id that does not belong to user', 2],
                ]),
              ])('for request with %s - %s', async (_, documentId) => {
                await request(app!.getHttpServer())
                  .delete(`/documents/${documentId}`)
                  .auth(fixtures.existing.account.accessToken!, {
                    type: 'bearer',
                  })
                  .expect(databaseShouldBeAvailable ? 200 : 500)
                  .expect(
                    databaseShouldBeAvailable
                      ? {}
                      : {
                          message:
                            'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                          error: 'Internal Server Error',
                          statusCode: 500,
                        },
                  );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [
                        fixtures.existing.document,
                        fixtures.existing.document_2,
                        fixtures.existing.document_3,
                      ]
                    : [],
                  databaseShouldBeAvailable,
                  dataSource!,
                );
              });
            },
          );

          describe('should 401, not alter database and return message that explains error cause', () => {
            it.each([
              ['for request with no authorization header', false],
              ['for request with invalid authorization header', true],
            ])('%s', async (_, invalidAuthorizationHeader) => {
              let req = request(app!.getHttpServer()).delete('/documents/1');

              if (invalidAuthorizationHeader) {
                req = req.auth('invalid-token', { type: 'bearer' });
              }

              await req.expect(401).expect({
                message: 'Unauthorized',
                statusCode: 401,
              });

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.existing.document,
                      fixtures.existing.document_2,
                      fixtures.existing.document_3,
                    ]
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
});
