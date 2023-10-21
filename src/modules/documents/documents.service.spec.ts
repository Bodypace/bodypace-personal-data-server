import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { DataSource } from 'typeorm';
import { unlink, rm, mkdir } from 'node:fs/promises';
import utils from '../../../test/utils';
import type { TestDocument } from '../../../test/utils';

interface Fixtures {
  firstDocument: TestDocument;
  secondDocument: TestDocument;
}

const constants = {
  databaseDir: 'database',
  databasePath: 'database/documents-service-test.sqlite',
  databaseDocumentsDir: 'database/documents',

  testDataDir: 'test/data',
  testDocumentsDir: 'test/data/documents',
  testDocumentName: 'sample-document.pdf',
  testDocumentPath: 'test/data/documents' + '/' + 'sample-document.pdf',

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

describe('DocumentsService', () => {
  const fixtures: Fixtures = {
    firstDocument: {},
    secondDocument: {},
  };

  let service: DocumentsService;
  let dataSource: DataSource;

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
        TypeOrmModule.forFeature([Document]),
      ],
      providers: [DocumentsService],
    }).compile();

    service = module.get<DocumentsService>(DocumentsService);
    dataSource = module.get<DataSource>(DataSource);
  });

  afterEach(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    await unlink(constants.databasePath);
    await rm(constants.databaseDocumentsDir, { recursive: true });
    await mkdir(constants.databaseDocumentsDir);

    fixtures.firstDocument = {};
    fixtures.secondDocument = {};
  });

  it('service should be defined', () => {
    expect(service).toBeDefined();
  });

  it('service should use database/documents as storagePath', () => {
    expect(service.storagePath).toBe('database/documents');
  });

  it('dataSource should be defined', () => {
    expect(dataSource).toBeDefined();
  });

  describe('create()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores document', true],
    ])('with database %s', (_, databaseShouldContainDocument: boolean) => {
      beforeEach(async () => {
        if (databaseShouldContainDocument) {
          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'UPLOADED-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';
          fixtures.firstDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.pdf.name,
          );

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
          );
        }

        fixtures.secondDocument.id = databaseShouldContainDocument ? 2 : 1;
        fixtures.secondDocument.name = 'uploaded-file.pdf';
        fixtures.secondDocument.path = constants.testDocument.markdown.path;
        fixtures.secondDocument.keys = 'second-file-keys';
        fixtures.secondDocument.file = await utils.newMulterFile(
          constants.testDocumentsDir,
          constants.testDocument.markdown.name,
        );
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
          describe('for correct arguments', () => {
            it('should store new document in database and return nothing', async () => {
              // NOTE: with this we also test `name` case insensivity without extra test
              if (databaseShouldContainDocument) {
                expect(fixtures.firstDocument.name!.toLowerCase()).toBe(
                  fixtures.secondDocument.name!.toLowerCase(),
                );
                expect(fixtures.firstDocument.name!).not.toBe(
                  fixtures.secondDocument.name!,
                );
              }

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                ),
              ).resolves.toBeUndefined();

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocument
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [fixtures.secondDocument],
                true,
                dataSource,
              );
            });
          });

          if (databaseShouldContainDocument) {
            describe('for correct arguments - same file under different name', () => {
              it('should store document again in database, not reuse it, and return nothing', async () => {
                // TODO: this test makes sure we do not reuse stored files but
                // actually we could and probably should reuse those files so
                // change spec (tests) and implement files reusage.
                // (if someone creates same file twice but for different names,
                //  in databaseDocumentsDir we should have only one file to save space)

                fixtures.secondDocument.file = fixtures.firstDocument.file;
                fixtures.secondDocument.path = fixtures.firstDocument.path;
                fixtures.secondDocument.keys = fixtures.firstDocument.keys;

                await expect(
                  service.create(
                    fixtures.secondDocument.name!,
                    fixtures.secondDocument.file!,
                    fixtures.secondDocument.keys!,
                  ),
                ).resolves.toBeUndefined();

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  [fixtures.firstDocument, fixtures.secondDocument],
                  true,
                  dataSource,
                );

                expect(fixtures.firstDocument.name).not.toBe(
                  fixtures.secondDocument.name,
                );

                await expect(
                  utils.filesEqual(
                    `${constants.databaseDocumentsDir}/${fixtures.firstDocument.name}`,
                    `${constants.databaseDocumentsDir}/${fixtures.secondDocument.name}`,
                  ),
                ).resolves.toBeTruthy();
              });
            });
          }
        }

        if (databaseShouldContainDocument) {
          describe('for incorrect name - already taken', () => {
            it('should not alter database and throw error with correct message', async () => {
              // NOTE: this could cause huge time/performance costs if frontend handles this error incorrectly.
              // Frontend performs encryption and if the file was large (took long time to encrypt) failure on sending it to server
              // just because name is already taken should not result in dropping such encrypted file.
              // Make sure frontend does not immediately remove encrypted file upon receiving this error so that
              // user can just give a different name to the file and upload it again.
              // NOTE: also, controller or frontend could first check if the name is available and then upload it
              // to avoid waisting bandwith and time.

              fixtures.secondDocument.name = fixtures.firstDocument.name;

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                ),
              ).rejects.toThrow(
                databaseShouldBeAvailable
                  ? `Cannot create document because name already exists: ${fixtures.firstDocument.name}`
                  : 'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocument ? [fixtures.firstDocument] : [],
                databaseShouldBeAvailable,
                dataSource,
              );
            });
          });
        }

        describe.each([
          ['name', '', '`name` must be a non-empty string'],
          ['keys', '', '`keys` must be a non-empty string'],
        ])(
          'for incorrect %s - "%s"',
          (incorrectField: 'name' | 'keys', incorrectValue, errorMessage) => {
            it('should not alter database and throw error with correct message', async () => {
              fixtures.secondDocument[incorrectField] = incorrectValue;

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                ),
              ).rejects.toStrictEqual(Error(errorMessage));

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocument ? [fixtures.firstDocument] : [],
                databaseShouldBeAvailable,
                dataSource,
              );
            });
          },
        );
      });
    });
  });

  describe('findAll()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores two documents', true],
    ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
      beforeEach(async () => {
        if (databaseShouldContainDocuments) {
          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'UPLOADED-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';
          fixtures.firstDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.pdf.name,
          );

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
          );
        }
      });

      describe('with database available', () => {
        it('should not alter database and return a list of stored documents', async () => {
          await expect(service.findAll()).resolves.toStrictEqual(
            databaseShouldContainDocuments
              ? [
                  utils.newDocument(
                    fixtures.firstDocument.id!,
                    fixtures.firstDocument.name!,
                    fixtures.firstDocument.keys!,
                  ),
                  utils.newDocument(
                    fixtures.secondDocument.id!,
                    fixtures.secondDocument.name!,
                    fixtures.secondDocument.keys!,
                  ),
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
            dataSource,
          );
        });
      });

      describe('with database not available', () => {
        beforeEach(async () => {
          await dataSource!.destroy();
        });

        it('should not alter database and throw error which explains that db is not accessible', async () => {
          await expect(service.findAll()).rejects.toThrow(
            'Connection with sqlite database is not established. Check connection configuration.',
          );

          await utils.expectDatabaseDocumentsState(
            constants.databasePath,
            constants.databaseDocumentsDir,
            databaseShouldContainDocuments
              ? [fixtures.firstDocument, fixtures.secondDocument]
              : [],
            false,
            dataSource,
          );
        });
      });
    });
  });

  describe('findOne()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores two documents', true],
    ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
      beforeEach(async () => {
        if (databaseShouldContainDocuments) {
          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'UPLOADED-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';
          fixtures.firstDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.pdf.name,
          );

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
          );
        }
      });

      describe('with database available', () => {
        if (databaseShouldContainDocuments) {
          describe.each([
            ['first document id', 1],
            ['second document id', 2],
          ])('with %s', (_, documentId) => {
            it('should not alter database and return selected document', async () => {
              const expectedDocument =
                documentId === fixtures.firstDocument.id
                  ? fixtures.firstDocument
                  : fixtures.secondDocument;

              expect(expectedDocument.id).toBe(documentId);

              await expect(service.findOne(documentId)).resolves.toStrictEqual(
                utils.newDocument(
                  expectedDocument.id!,
                  expectedDocument.name!,
                  expectedDocument.keys!,
                ),
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [],
                true,
                dataSource,
              );
            });
          });

          describe('for unknown document id - decimal 1.001', () => {
            it('should not alter database and return null', async () => {
              await expect(service.findOne(1.001)).resolves.toBeNull();

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [],
                true,
                dataSource,
              );
            });
          });
        }

        describe('for unknown document id', () => {
          it('should not alter database and return null', async () => {
            const unknownId = databaseShouldContainDocuments ? 3 : 1;

            await expect(service.findOne(unknownId)).resolves.toBeNull();

            await utils.expectDatabaseDocumentsState(
              constants.databasePath,
              constants.databaseDocumentsDir,
              databaseShouldContainDocuments
                ? [fixtures.firstDocument, fixtures.secondDocument]
                : [],
              true,
              dataSource,
            );
          });
        });
      });

      describe('with database not available', () => {
        beforeEach(async () => {
          await dataSource!.destroy();
        });

        describe.each([[1], [2], [3]])('for document id - %s', (documentId) => {
          it('should not alter database and return error which explains that db is not accessible', async () => {
            await expect(service.findOne(documentId)).rejects.toThrow(
              'Connection with sqlite database is not established. Check connection configuration.',
            );

            await utils.expectDatabaseDocumentsState(
              constants.databasePath,
              constants.databaseDocumentsDir,
              databaseShouldContainDocuments
                ? [fixtures.firstDocument, fixtures.secondDocument]
                : [],
              false,
              dataSource,
            );
          });
        });
      });
    });
  });

  describe('remove()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores two documents', true],
    ])('with database %s', (_, databaseShouldContainDocuments: boolean) => {
      beforeEach(async () => {
        if (databaseShouldContainDocuments) {
          fixtures.firstDocument.id = 1;
          fixtures.firstDocument.name = 'UPLOADED-file.pdf';
          fixtures.firstDocument.path = constants.testDocument.pdf.path;
          fixtures.firstDocument.keys = 'first-file-keys';
          fixtures.firstDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.pdf.name,
          );

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
          );
        }
      });

      describe('with database available', () => {
        if (databaseShouldContainDocuments) {
          describe.each([
            ['first document id', 1],
            ['second document id', 2],
          ])('with %s', (_, documentId) => {
            it('should remove selected document from database and return nothing', async () => {
              const expectedDocumentLeft =
                documentId === fixtures.firstDocument.id
                  ? fixtures.secondDocument
                  : fixtures.firstDocument;

              expect(expectedDocumentLeft.id).not.toBe(documentId);

              await expect(service.remove(documentId)).resolves.toBeUndefined();

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments ? [expectedDocumentLeft] : [],
                true,
                dataSource,
              );
            });
          });

          describe('for unknown document id - decimal 1.001', () => {
            it('should not alter database and throw error which explains that document id is unknown', async () => {
              await expect(service.remove(1.001)).rejects.toThrow(
                'Cannot remove document from database, unknown id #1.001',
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [fixtures.firstDocument, fixtures.secondDocument]
                  : [],
                true,
                dataSource,
              );
            });
          });
        }

        describe('for unknown document id', () => {
          it('should not alter database and throw error which explains that document id is unknown', async () => {
            const unknownId = databaseShouldContainDocuments ? 3 : 1;

            await expect(service.remove(unknownId)).rejects.toThrow(
              `Cannot remove document from database, unknown id #${unknownId}`,
            );

            await utils.expectDatabaseDocumentsState(
              constants.databasePath,
              constants.databaseDocumentsDir,
              databaseShouldContainDocuments
                ? [fixtures.firstDocument, fixtures.secondDocument]
                : [],
              true,
              dataSource,
            );
          });
        });
      });

      describe('with database not available', () => {
        beforeEach(async () => {
          await dataSource!.destroy();
        });

        describe.each([[1], [2], [3]])('for document id - %s', (documentId) => {
          it('should not alter database and throw error which explains that db is not accessible', async () => {
            await expect(service.findOne(documentId)).rejects.toThrow(
              'Connection with sqlite database is not established. Check connection configuration.',
            );

            await utils.expectDatabaseDocumentsState(
              constants.databasePath,
              constants.databaseDocumentsDir,
              databaseShouldContainDocuments
                ? [fixtures.firstDocument, fixtures.secondDocument]
                : [],
              false,
              dataSource,
            );
          });
        });
      });
    });
  });
});
