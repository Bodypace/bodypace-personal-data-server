import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { rm, mkdir, writeFile } from 'node:fs/promises';
import utils from './utils';
import type { TestFixtures } from './utils';

const constants = {
  databaseDir: 'database',
  databasePath: 'database/database.sqlite',
  databaseDocumentsDir: 'database/documents',

  testDataDir: 'test/data',
  testDocumentsDir: 'test/data/documents',
  testDocument: {
    pdf: {
      name: 'sample-document.pdf',
      path: 'test/data/documents' + '/' + 'sample-document.pdf',
    },
    markdown: {
      name: 'sample-document.md',
      path: 'test/data/documents' + '/' + 'sample-document.md',
    },
    empty: {
      name: 'sample-empty-document.txt',
      path: 'test/data/documents' + '/' + 'sample-empty-document.txt',
    },
  },
};

interface Helpers {
  expectDatabaseWasNotAltered?: () => Promise<void>;
}

describe('DocumentsController (e2e)', () => {
  const fixtures: TestFixtures = {
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

    fixtures.firstDocument = {};
    fixtures.secondDocument = {};
    fixtures.uploadedFile = undefined;

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

    describe('/ (POST)', () => {
      describe.each([
        ['that is empty', false],
        ['that already stores a document', true],
      ])('with database %s', (_, databaseShouldContainDocument) => {
        beforeEach(async () => {
          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'first-uploaded-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'second-uploaded-file.md';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';

          if (databaseShouldContainDocument) {
            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.firstDocument.path)
              .field('name', fixtures.firstDocument.name)
              .field('keys', fixtures.firstDocument.keys)
              .expect(201)
              .expect({});
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
                databaseShouldContainDocument ? [fixtures.firstDocument] : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            };
          });

          if (databaseShouldBeAvailable) {
            if (!databaseShouldContainDocument) {
              describe('for request that is correct', () => {
                it('should 201, store document in database and return nothing', async () => {
                  fixtures.firstDocument.id = 1;
                  fixtures.firstDocument.name = 'my-uploaded-file.pdf';
                  fixtures.firstDocument.path = constants.testDocument.pdf.path;
                  fixtures.firstDocument.keys = 'aaaa-bbbb-cccc-dddd';

                  await request(app!.getHttpServer())
                    .post('/documents')
                    .attach('file', fixtures.firstDocument.path)
                    .field('name', fixtures.firstDocument.name)
                    .field('keys', fixtures.firstDocument.keys)
                    .expect(201)
                    .expect({});

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument],
                    true,
                    dataSource!,
                  );
                });
              });
            }

            if (databaseShouldContainDocument) {
              describe.each([
                ['different `name`, different `file` content and `keys`', true],
                ['different `name`, same `file` content and `keys`', false],
              ])(
                'for request that is correct - %s',
                (_, secondDocumentIsDifferent: boolean) => {
                  beforeEach(async () => {
                    if (!secondDocumentIsDifferent) {
                      fixtures.secondDocument.path =
                        fixtures.firstDocument.path;

                      fixtures.secondDocument.keys =
                        fixtures.firstDocument.keys;
                    }
                  });

                  it('should 201, store document in database and return nothing', async () => {
                    // TODO: When same file is uploaded twice (possibly under different name),
                    // that file should be shared/reused to save space.

                    await request(app!.getHttpServer())
                      .post('/documents')
                      .attach('file', fixtures.secondDocument.path!)
                      .field('name', fixtures.secondDocument.name!)
                      .field('keys', fixtures.secondDocument.keys!)
                      .expect(201)
                      .expect({});

                    await utils.expectDatabaseDocumentsState(
                      constants.databasePath,
                      constants.databaseDocumentsDir,
                      [fixtures.firstDocument, fixtures.secondDocument],
                      true,
                      dataSource!,
                    );
                  });
                },
              );
            }
          }

          if (!databaseShouldBeAvailable) {
            describe('for request that is correct', () => {
              it('should 500, not alter database and return message that explains error cause', async () => {
                // NOTE: maybe 503 would be better but MDN says it needs a few extra things
                // that I don't want to implement and feel are not crucial for now.

                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(500)
                  .expect({
                    statusCode: 500,
                    error: 'Internal Server Error',
                    message:
                      'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                  });

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocument ? [fixtures.firstDocument] : [],
                  false,
                  dataSource!,
                );
              });
            });
          }

          describe('for request that is not a multipart/form-data', () => {
            describe('for request that has Content-Type application/json and `file` field', () => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                const wrongContentType = 'application/json';
                await request(app!.getHttpServer())
                  .post('/documents')
                  .send({
                    name: fixtures.secondDocument.name,
                    file: 'preasumebly file content here as a text',
                    keys: fixtures.secondDocument.keys,
                  })
                  .set('Content-Type', wrongContentType)
                  .expect(400)
                  .expect({
                    message: ['property file should not exist'],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await helpers.expectDatabaseWasNotAltered!();
              });
            });

            describe('for request that has Content-Type application/json and no `file` field', () => {
              it('should 415, not alter database and return message that explains error cause', async () => {
                const wrongContentType = 'application/json';
                await request(app!.getHttpServer())
                  .post('/documents')
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

          describe.each([['Name'], ['NAME']])(
            'for request with `%s` field instead of `name`',
            (incorrectFormField) => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field(incorrectFormField, fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(400)
                  .expect({
                    message: [
                      `property ${incorrectFormField} should not exist`,
                      'name should not be empty',
                      'name must be a string',
                    ],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await helpers.expectDatabaseWasNotAltered!();
              });
            },
          );

          describe('for request with missing `name` field', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(400)
                .expect({
                  message: [
                    'name should not be empty',
                    'name must be a string',
                  ],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe('for request with empty `name` field', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', '')
                .field('keys', fixtures.secondDocument.keys!)
                .expect(400)
                .expect({
                  message: ['name should not be empty'],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe.each([['File'], ['FILE']])(
            'for request with `%s` field instead of `file`',
            (incorrectFormField) => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach(incorrectFormField, fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(400)
                  .expect({
                    message: 'Unexpected field', // TODO: this is bad, the error should be more descriptive
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await helpers.expectDatabaseWasNotAltered!();
              });
            },
          );

          describe('for request with missing `file` field (no file attached/uploading)', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .field('name', fixtures.secondDocument.name!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(400)
                .expect({
                  message: 'Missing `file` field that should upload file',
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          // TODO: test multiple files being attached/uploaded (under same name or few different at once)

          describe('for request with `file` field that is not a file', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
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
          });

          describe('for request with `file` that uploads empty file', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              fixtures.secondDocument.path = constants.testDocument.empty.path;

              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', fixtures.secondDocument.name!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(400)
                .expect({
                  message: 'Uploaded file cannot be empty',
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe.each([['Keys'], ['KEYS']])(
            'for request with `%s` field instead of `keys`',
            (incorrectFormField) => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field(incorrectFormField, fixtures.secondDocument.keys!)
                  .expect(400)
                  .expect({
                    message: [
                      `property ${incorrectFormField} should not exist`,
                      'keys should not be empty',
                      'keys must be a string',
                    ],
                    error: 'Bad Request',
                    statusCode: 400,
                  });

                await helpers.expectDatabaseWasNotAltered!();
              });
            },
          );

          describe('for request with missing `keys` field', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', fixtures.secondDocument.name!)
                .expect(400)
                .expect({
                  message: [
                    'keys should not be empty',
                    'keys must be a string',
                  ],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          describe('for request with empty `keys` field', () => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', fixtures.secondDocument.name!)
                .field('keys', '')
                .expect(400)
                .expect({
                  message: ['keys should not be empty'],
                  error: 'Bad Request',
                  statusCode: 400,
                });

              await helpers.expectDatabaseWasNotAltered!();
            });
          });

          // TODO: we could check that `keys` has decent size and a JSON structure and maybe something else.
          // It will not prevent 3rd party clients/frontends from incorrectly using this field but
          // at least most obvious errors will be catched.

          describe.each([['Field'], ['key'], ['type'], [' ']])(
            'for request with additional unknown field `%s`',
            (additionalUnknownField) => {
              it('should 400, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .post('/documents')
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
              });
            },
          );
        });
      });
    });

    describe('/:id (POST)', () => {
      describe('with database that is empty', () => {
        describe('with database available', () => {
          describe('for request that is correct', () => {
            it('should 404, not alter database and return message that explains error cause ', async () => {
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

    describe('/ (GET)', () => {
      describe.each([
        ['that is empty', false],
        ['that already stores two documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments) => {
        beforeEach(async () => {
          if (databaseShouldContainDocuments) {
            fixtures.firstDocument.id = 1;
            fixtures.firstDocument.name = 'first-uploaded-file.pdf';
            fixtures.firstDocument.path = constants.testDocument.pdf.path;
            fixtures.firstDocument.keys = 'first-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.firstDocument.path)
              .field('name', fixtures.firstDocument.name)
              .field('keys', fixtures.firstDocument.keys)
              .expect(201)
              .expect({});

            fixtures.secondDocument.id = 2;
            fixtures.secondDocument.name = 'second-uploaded-file.pdf';
            fixtures.secondDocument.path = constants.testDocument.markdown.path;
            fixtures.secondDocument.keys = 'second-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.secondDocument.path)
              .field('name', fixtures.secondDocument.name)
              .field('keys', fixtures.secondDocument.keys)
              .expect(201)
              .expect({});
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

          describe('for request that is correct', () => {
            if (databaseShouldBeAvailable) {
              it('should 200, not alter database and return list of documents', async () => {
                await request(app!.getHttpServer())
                  .get('/documents')
                  .expect(200)
                  .expect(
                    databaseShouldContainDocuments
                      ? [
                          {
                            id: 1,
                            name: fixtures.firstDocument.name,
                            keys: fixtures.firstDocument.keys,
                          },
                          {
                            id: 2,
                            name: fixtures.secondDocument.name,
                            keys: fixtures.secondDocument.keys,
                          },
                        ]
                      : [],
                  );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [fixtures.firstDocument, fixtures.secondDocument]
                    : [],
                  true,
                  dataSource!,
                );
              });
            } else {
              it('should 500, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .get('/documents')
                  .expect(500)
                  .expect({
                    message:
                      'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                    error: 'Internal Server Error',
                    statusCode: 500,
                  });

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [fixtures.firstDocument, fixtures.secondDocument]
                    : [],
                  false,
                  dataSource!,
                );
              });
            }
          });
        });
      });
    });

    describe('/:id (GET)', () => {
      describe.each([
        ['that is empty', false],
        ['that already stores two documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          if (databaseShouldContainDocuments) {
            fixtures.firstDocument.id = 1;
            fixtures.firstDocument.name = 'first-uploaded-file.pdf';
            fixtures.firstDocument.path = constants.testDocument.pdf.path;
            fixtures.firstDocument.keys = 'first-file-keys';

            fixtures.secondDocument.id = 2;
            fixtures.secondDocument.name = 'second-uploaded-file.pdf';
            fixtures.secondDocument.path = constants.testDocument.markdown.path;
            fixtures.secondDocument.keys = 'second-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.firstDocument.path)
              .field('name', fixtures.firstDocument.name)
              .field('keys', fixtures.firstDocument.keys)
              .expect(201)
              .expect({});

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.secondDocument.path)
              .field('name', fixtures.secondDocument.name)
              .field('keys', fixtures.secondDocument.keys)
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

          if (databaseShouldContainDocuments) {
            describe.each([
              ['correct (first document id - 1)', 1],
              ['correct technically (first document id - 001)', '001'],
              ['correct (second document id - 2)', 2],
            ])('for request that is %s', (_, correctDocumentId) => {
              if (databaseShouldBeAvailable) {
                it('should 200, not alter database and download correct document', async () => {
                  let data = '';
                  const response = await request(app!.getHttpServer())
                    .get(`/documents/${correctDocumentId}`)
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
                    Number(correctDocumentId) === 1
                      ? fixtures.firstDocument
                      : fixtures.secondDocument;

                  await expect(
                    utils.fileEquals(
                      `${constants.databaseDocumentsDir}/${document.name}`,
                      response.body,
                    ),
                  ).resolves.toBeTruthy();

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    true,
                    dataSource!,
                  );
                });
              } else {
                it('should 500, not alter database and return message that explains error cause', async () => {
                  await request(app!.getHttpServer())
                    .get(`/documents/${correctDocumentId}`)
                    .expect(500)
                    .expect({
                      message:
                        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                      error: 'Internal Server Error',
                      statusCode: 500,
                    });

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    false,
                    dataSource!,
                  );
                });
              }
            });
          }

          describe.each([
            ['unknown id', 3],
            ['negative number id', -1],
            ['0 as id (we count from 1)', 0],
          ])('for request with %s', (_, incorrectId) => {
            if (databaseShouldBeAvailable) {
              it('should 404, not alter database and return "404 Not Found" response', async () => {
                await request(app!.getHttpServer())
                  .get(`/documents/${incorrectId}`)
                  .expect(404)
                  .expect({
                    message: 'Not Found',
                    statusCode: 404,
                  });

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [fixtures.firstDocument, fixtures.secondDocument]
                    : [],
                  true,
                  dataSource!,
                );
              });
            } else {
              it('should 500, not alter database and return message that explains error cause', async () => {
                await request(app!.getHttpServer())
                  .get(`/documents/${incorrectId}`)
                  .expect(500)
                  .expect({
                    message:
                      'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                    error: 'Internal Server Error',
                    statusCode: 500,
                  });

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [fixtures.firstDocument, fixtures.secondDocument]
                    : [],
                  false,
                  dataSource!,
                );
              });
            }
          });

          describe.each([
            ['string as id', 'A'],
            ['floating point number as id (1.0)', '1.0'],
            ['floating point number as id (1.1)', '1.1'],
            ['floating point number as id (3.0)', '3.0'],
          ])('for request with %s', (_, incorrectId) => {
            it('should 400, not alter database and return message that explains error cause', async () => {
              await request(app!.getHttpServer())
                .get(`/documents/${incorrectId}`)
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
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        });
      });
    });

    // TODO: test that / (UPDATE) does not work
    // TODO: test that /:id (UPDATE) does not work
    // TODO: test that / (PATCH) does not work
    // TODO: test that /:id (PATCH) does not work

    describe('/ (DELETE)', () => {
      describe.each([
        ['that is empty', false],
        ['that already stores two documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          if (databaseShouldContainDocuments) {
            fixtures.firstDocument.id = 1;
            fixtures.firstDocument.name = 'first-uploaded-file.pdf';
            fixtures.firstDocument.path = constants.testDocument.pdf.path;
            fixtures.firstDocument.keys = 'first-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.firstDocument.path)
              .field('name', fixtures.firstDocument.name)
              .field('keys', fixtures.firstDocument.keys)
              .expect(201)
              .expect({});

            fixtures.secondDocument.id = 2;
            fixtures.secondDocument.name = 'second-uploaded-file.pdf';
            fixtures.secondDocument.path = constants.testDocument.markdown.path;
            fixtures.secondDocument.keys = 'second-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.secondDocument.path)
              .field('name', fixtures.secondDocument.name)
              .field('keys', fixtures.secondDocument.keys)
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
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [],
                databaseShouldBeAvailable,
                dataSource!,
              );
            });
          });
        });
      });
    });

    describe('/:id (DELETE)', () => {
      // TODO: all correct responses should use code 204, not 200
      // https://stackoverflow.com/questions/2342579/http-status-code-for-update-and-delete
      // NOTE: for other endpoints if those do not return data no 200, 204 should probably be used aswell.

      describe.each([
        ['that is empty', false],
        ['that already stores two documents', true],
      ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
        beforeEach(async () => {
          if (databaseShouldContainDocuments) {
            fixtures.firstDocument.id = 1;
            fixtures.firstDocument.name = 'first-uploaded-file.pdf';
            fixtures.firstDocument.path = constants.testDocument.pdf.path;
            fixtures.firstDocument.keys = 'first-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.firstDocument.path)
              .field('name', fixtures.firstDocument.name)
              .field('keys', fixtures.firstDocument.keys)
              .expect(201)
              .expect({});

            fixtures.secondDocument.id = 2;
            fixtures.secondDocument.name = 'second-uploaded-file.pdf';
            fixtures.secondDocument.path = constants.testDocument.markdown.path;
            fixtures.secondDocument.keys = 'second-file-keys';

            await request(app!.getHttpServer())
              .post('/documents')
              .attach('file', fixtures.secondDocument.path)
              .field('name', fixtures.secondDocument.name)
              .field('keys', fixtures.secondDocument.keys)
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
            if (databaseShouldContainDocuments) {
              describe.each([[1], [2]])(
                'for request with known document id (%s)',
                (documentId) => {
                  it('should 200, remove only mentioned document from database and return nothing', async () => {
                    await request(app!.getHttpServer())
                      .delete(`/documents/${documentId}`)
                      .expect(200)
                      .expect({});

                    const remainingDocument =
                      documentId === 1
                        ? fixtures.secondDocument
                        : fixtures.firstDocument;

                    await utils.expectDatabaseDocumentsState(
                      constants.databasePath,
                      constants.databaseDocumentsDir,
                      [remainingDocument],
                      true,
                      dataSource!,
                    );
                  });
                },
              );
            }

            describe('for request with unknown document id', () => {
              it('should 200, not alter database and return nothing ', async () => {
                await request(app!.getHttpServer())
                  .delete('/documents/3')
                  .expect(200)
                  .expect({});

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [fixtures.firstDocument, fixtures.secondDocument]
                    : [],
                  true,
                  dataSource!,
                );
              });
            });
          }

          if (!databaseShouldBeAvailable) {
            describe.each([[1], [2], [3]])(
              'for request with document id (%s)',
              (documentId) => {
                it('should 500, not alter database and return message that explains error cause', async () => {
                  await request(app!.getHttpServer())
                    .delete(`/documents/${documentId}`)
                    .expect(500)
                    .expect({
                      message:
                        'This operation is temporarily unavailable due to some database service problem on our end, please try again later.',
                      error: 'Internal Server Error',
                      statusCode: 500,
                    });

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    databaseShouldContainDocuments
                      ? [fixtures.firstDocument, fixtures.secondDocument]
                      : [],
                    false,
                    dataSource!,
                  );
                });
              },
            );
          }
        });
      });
    });
  });
});
