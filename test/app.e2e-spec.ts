import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Document } from '../src/modules/documents/entities/document.entity';
import { rm, mkdir, writeFile, readdir } from 'node:fs/promises';
import utils from './utils';

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

interface Fixtures {
  firstDocument: {
    id?: number;
    name?: string;
    path?: string;
    keys?: string;
  };
  secondDocument: {
    id?: number;
    name?: string;
    path?: string;
    keys?: string;
  };
  uploadedFile?: Express.Multer.File;
}

interface Helpers {
  expectDatabaseWasNotAltered?: () => Promise<void>;
}

describe('AppController (e2e)', () => {
  const fixtures: Fixtures = {
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
      describe('with database that is empty', () => {
        describe('with database available', () => {
          describe('for request that is correct', () => {
            it('should 201 and return nothing', () => {
              fixtures.firstDocument.name = 'my-uploaded-file.pdf';
              fixtures.firstDocument.path = constants.testDocument.pdf.path;
              fixtures.firstDocument.keys = 'aaaa-bbbb-cccc-dddd';

              return request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.firstDocument.path)
                .field('name', fixtures.firstDocument.name)
                .field('keys', fixtures.firstDocument.keys)
                .expect(201)
                .expect({});
            });

            it('should 201 and store document info in SQL database', async () => {
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

              const documentsRepository = dataSource!.getRepository(Document);
              await expect(documentsRepository.find()).resolves.toStrictEqual([
                utils.newDocument(
                  1,
                  fixtures.firstDocument.name,
                  fixtures.firstDocument.keys,
                ),
              ]);
            });

            it('should 201 and store uploaded file in database folder', async () => {
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

              await expect(
                readdir(constants.databaseDocumentsDir),
              ).resolves.toStrictEqual([fixtures.firstDocument.name]);

              await expect(
                utils.filesEqual(
                  fixtures.firstDocument.path,
                  `${constants.databaseDocumentsDir}/${fixtures.firstDocument.name}`,
                ),
              ).resolves.toBeTruthy();
            });
          });
        });
      });

      describe('with database that already stores a document', () => {
        describe('with database available', () => {
          describe.each([
            ['different `name`, different `file` content and `keys`', true],
            ['different `name`, same `file` content and `keys`', false],
          ])(
            'for request that is correct - %s',
            (_, secondDocumentIsDifferent: boolean) => {
              beforeEach(async () => {
                fixtures.firstDocument.name = 'my-uploaded-file.pdf';
                fixtures.firstDocument.path = constants.testDocument.pdf.path;
                fixtures.firstDocument.keys = 'aaaa-bbbb-cccc-dddd';

                fixtures.secondDocument.name = 'my-uploaded-file.md';
                if (secondDocumentIsDifferent) {
                  fixtures.secondDocument.path =
                    constants.testDocument.markdown.path;
                  fixtures.secondDocument.keys = 'aaaa-bbbb-cccc-dddd-eeee';
                } else {
                  fixtures.secondDocument.path = fixtures.firstDocument.path;
                  fixtures.secondDocument.keys = fixtures.firstDocument.keys;
                }

                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.firstDocument.path)
                  .field('name', fixtures.firstDocument.name)
                  .field('keys', fixtures.firstDocument.keys)
                  .expect(201)
                  .expect({});
              });

              it('should 201 and return nothing', () => {
                return request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(201)
                  .expect({});
              });

              it('should 201 and store document info in SQL database (now 2 entries)', async () => {
                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(201)
                  .expect({});

                const documentsRepository = dataSource!.getRepository(Document);
                await expect(documentsRepository.find()).resolves.toStrictEqual(
                  [
                    utils.newDocument(
                      1,
                      fixtures.firstDocument.name!,
                      fixtures.firstDocument.keys!,
                    ),
                    utils.newDocument(
                      2,
                      fixtures.secondDocument.name!,
                      fixtures.secondDocument.keys!,
                    ),
                  ],
                );
              });

              it('should 201 and store uploaded file in database folder (now 2 files)', async () => {
                // TODO: When same file is uploaded twice (possibly under different name),
                // that file should be shared/reused to save space.
                await request(app!.getHttpServer())
                  .post('/documents')
                  .attach('file', fixtures.secondDocument.path!)
                  .field('name', fixtures.secondDocument.name!)
                  .field('keys', fixtures.secondDocument.keys!)
                  .expect(201)
                  .expect({});

                await expect(
                  readdir(constants.databaseDocumentsDir),
                ).resolves.toStrictEqual([
                  fixtures.secondDocument.name,
                  fixtures.firstDocument.name,
                ]);

                await expect(
                  utils.filesEqual(
                    fixtures.firstDocument.path!,
                    `${constants.databaseDocumentsDir}/${fixtures.firstDocument.name}`,
                  ),
                ).resolves.toBeTruthy();

                await expect(
                  utils.filesEqual(
                    fixtures.secondDocument.path!,
                    `${constants.databaseDocumentsDir}/${fixtures.secondDocument.name}`,
                  ),
                ).resolves.toBeTruthy();
              });
            },
          );
        });
      });

      describe.each([
        ['that is empty', false],
        ['that already stores a document', true],
      ])('with database %s', (_, databaseShouldContainDocument: boolean) => {
        beforeEach(async () => {
          if (databaseShouldContainDocument) {
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
          }

          fixtures.secondDocument.name = 'my-uploaded-file.md';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'aaaa-bbbb-cccc-dddd-eeee';
        });

        describe('with database not available', () => {
          beforeEach(async () => {
            await dataSource!.destroy();
          });

          describe('for request that is correct', () => {
            it('should 500 and return message that explains error cause', () => {
              // NOTE: maybe 503 would be better but MDN says it needs a few extra things
              // that I don't want to implement and feel are not crucial for now.
              return request(app!.getHttpServer())
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
            });

            it('should 500 and not alter SQL database', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', fixtures.secondDocument.name!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(500);

              expect(dataSource!.isInitialized).toBeFalsy();
              dataSource = await utils.newDataSource(constants.databasePath);
              expect(dataSource!.isInitialized).toBeTruthy();

              const documentsRepository = dataSource!.getRepository(Document);
              await expect(documentsRepository.find()).resolves.toStrictEqual(
                databaseShouldContainDocument
                  ? [
                      utils.newDocument(
                        1,
                        fixtures.firstDocument.name!,
                        fixtures.firstDocument.keys!,
                      ),
                    ]
                  : [],
              );
            });

            it('should 500 and not alter database folder with uploaded files', async () => {
              await request(app!.getHttpServer())
                .post('/documents')
                .attach('file', fixtures.secondDocument.path!)
                .field('name', fixtures.secondDocument.name!)
                .field('keys', fixtures.secondDocument.keys!)
                .expect(500);

              await expect(
                readdir(constants.databaseDocumentsDir),
              ).resolves.toStrictEqual(
                databaseShouldContainDocument
                  ? [fixtures.firstDocument.name]
                  : [],
              );

              if (databaseShouldContainDocument) {
                await expect(
                  utils.filesEqual(
                    fixtures.firstDocument.path!,
                    `${constants.databaseDocumentsDir}/${fixtures.firstDocument.name}`,
                  ),
                ).resolves.toBeTruthy();
              }
            });
          });
        });
      });

      describe.each([
        ['that is empty', false],
        ['that already stores a document', true],
      ])('with database %s', (_, databaseShouldContainDocument: boolean) => {
        beforeEach(async () => {
          if (databaseShouldContainDocument) {
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
          }

          fixtures.secondDocument.name = 'my-uploaded-file.md';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'aaaa-bbbb-cccc-dddd-eeee';
        });

        describe.each([
          ['available', true],
          ['not available', false],
        ])('with database %s', (_, databaseShouldBeAvailable: boolean) => {
          beforeEach(async () => {
            if (!databaseShouldBeAvailable) {
              await dataSource!.destroy();
            }

            helpers.expectDatabaseWasNotAltered = async () => {
              if (!databaseShouldBeAvailable) {
                expect(dataSource!.isInitialized).toBeFalsy();
                dataSource = await utils.newDataSource(constants.databasePath);
              }
              expect(dataSource!.isInitialized).toBeTruthy();

              const documentsRepository = dataSource!.getRepository(Document);
              await expect(documentsRepository.find()).resolves.toStrictEqual(
                databaseShouldContainDocument
                  ? [
                      utils.newDocument(
                        1,
                        fixtures.firstDocument.name!,
                        fixtures.firstDocument.keys!,
                      ),
                    ]
                  : [],
              );

              await expect(
                readdir(constants.databaseDocumentsDir),
              ).resolves.toStrictEqual(
                databaseShouldContainDocument
                  ? [fixtures.firstDocument.name]
                  : [],
              );

              if (databaseShouldContainDocument) {
                await expect(
                  utils.filesEqual(
                    fixtures.firstDocument.path!,
                    `${constants.databaseDocumentsDir}/${fixtures.firstDocument.name}`,
                  ),
                ).resolves.toBeTruthy();
              }
            };
          });

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

              const documentsRepository = dataSource!.getRepository(Document);
              await expect(documentsRepository.find()).resolves.toStrictEqual(
                [],
              );

              await expect(
                readdir(constants.databaseDocumentsDir),
              ).resolves.toStrictEqual([]);
            });
          });
        });
      });
    });

    /*

    // below tests are just my notes, not actual tests that could be uncommented and ran.

    describe('/ (GET)', () => {
      describe('with nothing stored in database', () => {
        describe('with database available', () => {
          it('should 200 and return empty array', () => {
            return request(app!.getHttpServer())
              .get('/documents')
              .expect(200)
              .expect([]);
          });
        });
      });

      describe('with two documents stored in database', () => {
        // TODO
      });
    });

    describe('/:id (GET)', () => {
      describe('with nothing stored in database', () => {
        describe('with database available', () => {
          describe('for unknown document id', () => {
            it('should 200 and return nothing', () => {
              fixtures.firstDocument.id = 43;

              return request(app!.getHttpServer())
                .get(`/documents/${fixtures.firstDocument.id}`)
                .expect(200)
                .expect({});
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
      it('should 404', () => {
        return request(app!.getHttpServer())
          .delete('/documents')
          .expect(404)
          .expect({
            message: 'Cannot DELETE /documents',
            error: 'Not Found',
            statusCode: 404,
          });
      });
    });

    describe('/:id (DELETE)', () => {
      describe('with nothing stored in database', () => {
        describe('with database available', () => {
          describe('for unknown document id', () => {
            it('asd', () => {
              // TODO
            });
          });
        });
      });
    });
    */
  });
});
