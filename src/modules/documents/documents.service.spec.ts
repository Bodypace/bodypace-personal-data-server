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
  thirdDocument: TestDocument;
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
    text: {
      name: 'sample-document.txt',
      path: 'test/data/documents' + '/' + 'sample-document.txt',
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
    thirdDocument: {},
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
    fixtures.thirdDocument = {};
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
          fixtures.firstDocument.userId = 1;

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
            fixtures.firstDocument.userId,
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
        fixtures.secondDocument.userId = 2;
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

        describe('for correct arguments', () => {
          if (databaseShouldBeAvailable) {
            it('should store new document in database and return nothing', async () => {
              expect(fixtures.firstDocument.userId).not.toBe(
                fixtures.secondDocument.userId,
              );

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                  fixtures.secondDocument.userId!,
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
          } else {
            it('should not alter database and throw error with correct message', async () => {
              expect(fixtures.firstDocument.userId).not.toBe(
                fixtures.secondDocument.userId,
              );

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                  fixtures.secondDocument.userId!,
                ),
              ).rejects.toThrow(
                'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocument ? [fixtures.firstDocument] : [],
                false,
                dataSource,
              );
            });
          }
        });

        if (databaseShouldContainDocument) {
          describe.each([
            ['same user', true],
            ['different user', false],
          ])(
            'for correct arguments - same file under different name (name differs only in case) - %s',
            (_, sameUser: boolean) => {
              beforeEach(() => {
                fixtures.secondDocument.file = fixtures.firstDocument.file;
                fixtures.secondDocument.path = fixtures.firstDocument.path;
                fixtures.secondDocument.keys = fixtures.firstDocument.keys;

                if (sameUser) {
                  fixtures.secondDocument.userId =
                    fixtures.firstDocument.userId;
                }
              });

              if (databaseShouldBeAvailable) {
                it('should store document again in database, not reuse it, and return nothing', async () => {
                  // TODO: this test makes sure we do not reuse stored files but
                  // actually we could and probably should reuse those files so
                  // change spec (tests) and implement files reusage.
                  // (if someone creates same file twice but for different names,
                  //  in databaseDocumentsDir we should have only one file to save space)

                  if (sameUser) {
                    expect(fixtures.firstDocument.userId).toBe(
                      fixtures.secondDocument.userId,
                    );
                  } else {
                    expect(fixtures.firstDocument.userId).not.toBe(
                      fixtures.secondDocument.userId,
                    );
                  }

                  expect(fixtures.firstDocument.name!.toLowerCase()).toBe(
                    fixtures.secondDocument.name!.toLowerCase(),
                  );
                  expect(fixtures.firstDocument.name!).not.toBe(
                    fixtures.secondDocument.name!,
                  );

                  await expect(
                    service.create(
                      fixtures.secondDocument.name!,
                      fixtures.secondDocument.file!,
                      fixtures.secondDocument.keys!,
                      fixtures.secondDocument.userId!,
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
                      `${constants.databaseDocumentsDir}/${fixtures.firstDocument.userId}/${fixtures.firstDocument.name}`,
                      `${constants.databaseDocumentsDir}/${fixtures.secondDocument.userId}/${fixtures.secondDocument.name}`,
                    ),
                  ).resolves.toBeTruthy();
                });
              } else {
                it('should not alter database and throw error with correct message', async () => {
                  if (sameUser) {
                    expect(fixtures.firstDocument.userId).toBe(
                      fixtures.secondDocument.userId,
                    );
                  } else {
                    expect(fixtures.firstDocument.userId).not.toBe(
                      fixtures.secondDocument.userId,
                    );
                  }

                  expect(fixtures.firstDocument.name!.toLowerCase()).toBe(
                    fixtures.secondDocument.name!.toLowerCase(),
                  );
                  expect(fixtures.firstDocument.name!).not.toBe(
                    fixtures.secondDocument.name!,
                  );

                  await expect(
                    service.create(
                      fixtures.secondDocument.name!,
                      fixtures.secondDocument.file!,
                      fixtures.secondDocument.keys!,
                      fixtures.secondDocument.userId!,
                    ),
                  ).rejects.toThrow(
                    'Connection with sqlite database is not established. Check connection configuration.',
                  );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument],
                    false,
                    dataSource,
                  );
                });
              }
            },
          );

          describe('for correct arguments - already taken name - different user', () => {
            if (databaseShouldBeAvailable) {
              it('should store new document in database and return nothing', async () => {
                fixtures.secondDocument.name = fixtures.firstDocument.name;

                expect(fixtures.firstDocument.name!).toBe(
                  fixtures.secondDocument.name!,
                );

                expect(fixtures.firstDocument.userId).not.toBe(
                  fixtures.secondDocument.userId,
                );

                await expect(
                  service.create(
                    fixtures.secondDocument.name!,
                    fixtures.secondDocument.file!,
                    fixtures.secondDocument.keys!,
                    fixtures.secondDocument.userId!,
                  ),
                ).resolves.toBeUndefined();

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  [fixtures.firstDocument, fixtures.secondDocument],
                  true,
                  dataSource,
                );
              });
            } else {
              it('should not alter database and throw error with correct message', async () => {
                fixtures.secondDocument.name = fixtures.firstDocument.name;

                expect(fixtures.firstDocument.name!).toBe(
                  fixtures.secondDocument.name!,
                );

                expect(fixtures.firstDocument.userId).not.toBe(
                  fixtures.secondDocument.userId,
                );

                await expect(
                  service.create(
                    fixtures.secondDocument.name!,
                    fixtures.secondDocument.file!,
                    fixtures.secondDocument.keys!,
                    fixtures.secondDocument.userId!,
                  ),
                ).rejects.toThrow(
                  'Connection with sqlite database is not established. Check connection configuration.',
                );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  [fixtures.firstDocument],
                  false,
                  dataSource,
                );
              });
            }
          });

          describe('for incorrect arguments - already taken name - same user', () => {
            it('should not alter database and throw error with correct message', async () => {
              // NOTE: In scenario when database is available, this could cause huge time/performance costs
              // if frontend handles this error incorrectly.
              // Frontend performs encryption and if the file was large (took long time to encrypt) failure on sending it to server
              // just because name is already taken should not result in dropping such encrypted file.
              // Make sure frontend does not immediately remove encrypted file upon receiving this error so that
              // user can just give a different name to the file and upload it again.
              // NOTE: also, controller or frontend could first check if the name is available and then upload it
              // to avoid waisting bandwith and time.

              fixtures.secondDocument.name = fixtures.firstDocument.name;
              fixtures.secondDocument.userId = fixtures.firstDocument.userId;

              expect(fixtures.firstDocument.name!).toBe(
                fixtures.secondDocument.name!,
              );

              expect(fixtures.firstDocument.userId).toBe(
                fixtures.secondDocument.userId,
              );

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                  fixtures.secondDocument.userId!,
                ),
              ).rejects.toThrow(
                databaseShouldBeAvailable
                  ? `Cannot create document because name already exists: ${fixtures.firstDocument.name}`
                  : 'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                [fixtures.firstDocument],
                databaseShouldBeAvailable,
                dataSource,
              );
            });
          });
        }

        describe.each([
          ['name', '', '`name` must be a non-empty string'],
          ['keys', '', '`keys` must be a non-empty string'],
          ['userId', '', '`userId` must be a positive number'],
          ['userId', 0, '`userId` must be a positive number'],
          ['userId', -1, '`userId` must be a positive number'],
          ['userId', 'some string', '`userId` must be a positive number'],
        ])(
          'for incorrect %s - %s',
          (
            incorrectField: 'name' | 'keys' | 'userId',
            incorrectValue: typeof incorrectField extends 'userId'
              ? number
              : string,
            errorMessage,
          ) => {
            it('should not alter database and throw error with correct message', async () => {
              // NOTE: below if-else and above typeof incorrectField is the best I could do to make TS happy,
              // but it's probably not the best solution and I hope there is a better one
              if (incorrectField === 'userId') {
                fixtures.secondDocument[incorrectField] =
                  incorrectValue as unknown as number;
              } else {
                fixtures.secondDocument[incorrectField] =
                  incorrectValue as string;
              }

              await expect(
                service.create(
                  fixtures.secondDocument.name!,
                  fixtures.secondDocument.file!,
                  fixtures.secondDocument.keys!,
                  fixtures.secondDocument.userId!,
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
      ['that already stores three documents', true],
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
          fixtures.firstDocument.userId = 1;

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
            fixtures.firstDocument.userId,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );
          fixtures.secondDocument.userId = 1;

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
            fixtures.secondDocument.userId,
          );

          fixtures.thirdDocument.id = 3;
          fixtures.thirdDocument.name = constants.testDocument.text.name;
          fixtures.thirdDocument.path = constants.testDocument.text.path;
          fixtures.thirdDocument.keys = 'third-file-keys';
          fixtures.thirdDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.text.name,
          );
          fixtures.thirdDocument.userId = 3;

          await service.create(
            fixtures.thirdDocument.name,
            fixtures.thirdDocument.file,
            fixtures.thirdDocument.keys,
            fixtures.thirdDocument.userId,
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

        describe('for unknown userId - 2', () => {
          if (databaseShouldBeAvailable) {
            it('should not alter database and return empty list', async () => {
              const userId = 2;

              if (databaseShouldContainDocuments) {
                expect(userId).not.toBe(fixtures.firstDocument.userId);
                expect(userId).not.toBe(fixtures.secondDocument.userId);
                expect(userId).not.toBe(fixtures.thirdDocument.userId);
              }

              await expect(service.findAll(userId)).resolves.toStrictEqual([]);

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.firstDocument,
                      fixtures.secondDocument,
                      fixtures.thirdDocument,
                    ]
                  : [],
                true,
                dataSource,
              );
            });
          } else {
            it('should not alter database and throw error with correct message', async () => {
              const userId = 2;

              if (databaseShouldContainDocuments) {
                expect(userId).not.toBe(fixtures.firstDocument.userId);
                expect(userId).not.toBe(fixtures.secondDocument.userId);
                expect(userId).not.toBe(fixtures.thirdDocument.userId);
              }

              await expect(service.findAll(userId)).rejects.toThrow(
                'Connection with sqlite database is not established. Check connection configuration.',
              );

              await utils.expectDatabaseDocumentsState(
                constants.databasePath,
                constants.databaseDocumentsDir,
                databaseShouldContainDocuments
                  ? [
                      fixtures.firstDocument,
                      fixtures.secondDocument,
                      fixtures.thirdDocument,
                    ]
                  : [],
                false,
                dataSource,
              );
            });
          }
        });

        if (databaseShouldContainDocuments) {
          describe.each([
            ['known', 1, '(first user)'],
            ['known', 3, '(second user)'],
          ])('for %s userId - %s %s', (_, userId: number) => {
            if (databaseShouldBeAvailable) {
              it('should not alter database and return a list of stored documents belonging to this user', async () => {
                expect(fixtures.firstDocument.userId).toBe(
                  fixtures.secondDocument.userId,
                );
                expect(fixtures.firstDocument.userId).not.toBe(
                  fixtures.thirdDocument.userId,
                );

                await expect(service.findAll(userId)).resolves.toStrictEqual(
                  userId === fixtures.firstDocument.userId
                    ? [
                        utils.newDocument(
                          fixtures.firstDocument.id!,
                          fixtures.firstDocument.name!,
                          fixtures.firstDocument.keys!,
                          fixtures.firstDocument.userId!,
                        ),
                        utils.newDocument(
                          fixtures.secondDocument.id!,
                          fixtures.secondDocument.name!,
                          fixtures.secondDocument.keys!,
                          fixtures.secondDocument.userId!,
                        ),
                      ]
                    : userId === fixtures.thirdDocument.userId
                    ? [
                        utils.newDocument(
                          fixtures.thirdDocument.id!,
                          fixtures.thirdDocument.name!,
                          fixtures.thirdDocument.keys!,
                          fixtures.thirdDocument.userId!,
                        ),
                      ]
                    : [],
                );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  [
                    fixtures.firstDocument,
                    fixtures.secondDocument,
                    fixtures.thirdDocument,
                  ],
                  true,
                  dataSource,
                );
              });
            } else {
              it('should not alter database and throw error with correct message', async () => {
                expect(fixtures.firstDocument.userId).toBe(
                  fixtures.secondDocument.userId,
                );
                expect(fixtures.firstDocument.userId).not.toBe(
                  fixtures.thirdDocument.userId,
                );

                await expect(service.findAll(userId)).rejects.toThrow(
                  'Connection with sqlite database is not established. Check connection configuration.',
                );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  [
                    fixtures.firstDocument,
                    fixtures.secondDocument,
                    fixtures.thirdDocument,
                  ],
                  false,
                  dataSource,
                );
              });
            }
          });
        }
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
          fixtures.firstDocument.userId = 1;

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
            fixtures.firstDocument.userId,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );
          fixtures.secondDocument.userId = 3;

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
            fixtures.secondDocument.userId,
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

        describe('for unknown userId - 2, and unknown document id - 3', () => {
          if (databaseShouldBeAvailable) {
            it('should not alter database and return null', async () => {
              const userId = 2;
              const documentId = 3;

              if (databaseShouldContainDocuments) {
                expect(userId).not.toBe(fixtures.firstDocument.userId);
                expect(userId).not.toBe(fixtures.secondDocument.userId);
                expect(documentId).not.toBe(fixtures.firstDocument.id);
                expect(documentId).not.toBe(fixtures.secondDocument.id);
              }

              await expect(
                service.findOne(documentId, userId),
              ).resolves.toBeNull();

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
          } else {
            it('should not alter database and throw error with correct message', async () => {
              const userId = 2;
              const documentId = 3;

              if (databaseShouldContainDocuments) {
                expect(userId).not.toBe(fixtures.firstDocument.userId);
                expect(userId).not.toBe(fixtures.secondDocument.userId);
                expect(documentId).not.toBe(fixtures.firstDocument.id);
                expect(documentId).not.toBe(fixtures.secondDocument.id);
              }

              await expect(service.findOne(documentId, userId)).rejects.toThrow(
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
          }
        });

        if (databaseShouldContainDocuments) {
          describe.each([
            [1, 1, 'his'],
            [3, 2, 'his'],
            [1, 2, 'not his'],
            [3, 1, 'not his'],
          ])(
            'for known userId - %s, and known document id - %s (%s document)',
            (
              userId: number,
              documentId: number,
              relationBetweenUserAndDocument: 'his' | 'not his',
            ) => {
              if (databaseShouldBeAvailable) {
                if (relationBetweenUserAndDocument === 'his') {
                  it('should not alter database and return selected document', async () => {
                    const document =
                      documentId === fixtures.firstDocument.id
                        ? fixtures.firstDocument
                        : fixtures.secondDocument;

                    expect(documentId).toBe(document.id);
                    expect(userId).toBe(document.userId);

                    await expect(
                      service.findOne(documentId, userId),
                    ).resolves.toStrictEqual(
                      utils.newDocument(
                        documentId,
                        document.name!,
                        document.keys!,
                        userId,
                      ),
                    );

                    await utils.expectDatabaseDocumentsState(
                      constants.databasePath,
                      constants.databaseDocumentsDir,
                      [fixtures.firstDocument, fixtures.secondDocument],
                      true,
                      dataSource,
                    );
                  });
                } else {
                  it('should not alter database and return null', async () => {
                    const document =
                      documentId === fixtures.firstDocument.id
                        ? fixtures.firstDocument
                        : fixtures.secondDocument;

                    expect(documentId).toBe(document.id);
                    expect(userId).not.toBe(document.userId);

                    await expect(
                      service.findOne(documentId, userId),
                    ).resolves.toBeNull();

                    await utils.expectDatabaseDocumentsState(
                      constants.databasePath,
                      constants.databaseDocumentsDir,
                      [fixtures.firstDocument, fixtures.secondDocument],
                      true,
                      dataSource,
                    );
                  });
                }
              } else {
                it('should not alter database and throw error with correct message', async () => {
                  const document =
                    documentId === fixtures.firstDocument.id
                      ? fixtures.firstDocument
                      : fixtures.secondDocument;

                  if (relationBetweenUserAndDocument === 'his') {
                    expect(documentId).toBe(document.id);
                    expect(userId).toBe(document.userId);
                  } else {
                    expect(documentId).toBe(document.id);
                    expect(userId).not.toBe(document.userId);
                  }

                  await expect(
                    service.findOne(documentId, userId),
                  ).rejects.toThrow(
                    'Connection with sqlite database is not established. Check connection configuration.',
                  );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    false,
                    dataSource,
                  );
                });
              }
            },
          );

          describe.each([
            [1, 3],
            [1, 1.001],
            [3, 3],
          ])(
            'for known userId - %s, and unknown document id - %s',
            (userId: number, documentId: number) => {
              if (databaseShouldBeAvailable) {
                it('should not alter database and return null', async () => {
                  expect([
                    fixtures.firstDocument.userId,
                    fixtures.secondDocument.userId,
                  ]).toContain(userId);
                  expect(documentId).not.toBe(fixtures.firstDocument.id);
                  expect(documentId).not.toBe(fixtures.secondDocument.id);

                  await expect(
                    service.findOne(documentId, userId),
                  ).resolves.toBeNull();

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    true,
                    dataSource,
                  );
                });
              } else {
                it('should not alter database and throw error with correct message', async () => {
                  expect([
                    fixtures.firstDocument.userId,
                    fixtures.secondDocument.userId,
                  ]).toContain(userId);
                  expect(documentId).not.toBe(fixtures.firstDocument.id);
                  expect(documentId).not.toBe(fixtures.secondDocument.id);

                  await expect(
                    service.findOne(documentId, userId),
                  ).rejects.toThrow(
                    'Connection with sqlite database is not established. Check connection configuration.',
                  );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    false,
                    dataSource,
                  );
                });
              }
            },
          );

          describe.each([[1], [2]])(
            'for unknown userId - 2, and known document id - %s',
            (documentId: number) => {
              if (databaseShouldBeAvailable) {
                it('should not alter database and return null', async () => {
                  const userId = 2;

                  expect([
                    fixtures.firstDocument.userId,
                    fixtures.secondDocument.userId,
                  ]).not.toContain(userId);
                  expect([
                    fixtures.firstDocument.id,
                    fixtures.secondDocument.id,
                  ]).toContain(documentId);

                  await expect(
                    service.findOne(documentId, userId),
                  ).resolves.toBeNull();

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    true,
                    dataSource,
                  );
                });
              } else {
                it('should not alter database and throw error with correct message', async () => {
                  const userId = 2;

                  expect([
                    fixtures.firstDocument.userId,
                    fixtures.secondDocument.userId,
                  ]).not.toContain(userId);
                  expect([
                    fixtures.firstDocument.id,
                    fixtures.secondDocument.id,
                  ]).toContain(documentId);

                  await expect(
                    service.findOne(documentId, userId),
                  ).rejects.toThrow(
                    'Connection with sqlite database is not established. Check connection configuration.',
                  );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    [fixtures.firstDocument, fixtures.secondDocument],
                    false,
                    dataSource,
                  );
                });
              }
            },
          );
        }
      });
    });
  });

  describe('remove()', () => {
    describe.each([
      ['that is empty', false],
      ['that already stores three documents', true],
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
          fixtures.firstDocument.userId = 1;

          await service.create(
            fixtures.firstDocument.name,
            fixtures.firstDocument.file,
            fixtures.firstDocument.keys,
            fixtures.firstDocument.userId,
          );

          fixtures.secondDocument.id = 2;
          fixtures.secondDocument.name = 'uploaded-file.pdf';
          fixtures.secondDocument.path = constants.testDocument.markdown.path;
          fixtures.secondDocument.keys = 'second-file-keys';
          fixtures.secondDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.markdown.name,
          );
          fixtures.secondDocument.userId = 3;

          await service.create(
            fixtures.secondDocument.name,
            fixtures.secondDocument.file,
            fixtures.secondDocument.keys,
            fixtures.secondDocument.userId,
          );

          fixtures.thirdDocument.id = 3;
          fixtures.thirdDocument.name = constants.testDocument.text.name;
          fixtures.thirdDocument.path = constants.testDocument.text.path;
          fixtures.thirdDocument.keys = 'third-file-keys';
          fixtures.thirdDocument.file = await utils.newMulterFile(
            constants.testDocumentsDir,
            constants.testDocument.text.name,
          );
          fixtures.thirdDocument.userId = 1;

          await service.create(
            fixtures.thirdDocument.name,
            fixtures.thirdDocument.file,
            fixtures.thirdDocument.keys,
            fixtures.thirdDocument.userId,
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

        describe.each([
          ...(databaseShouldContainDocuments
            ? [
                ['known', 1, 'his', 1, true],
                ['known', 1, 'his', 3, true],
                ['known', 1, 'not his', 2, false],
                ['known', 1, 'unknown', 1.001, false],
                ['known', 1, 'unknown', 4, false],
                ['known', 3, 'his', 2, true],
                ['known', 3, 'not his', 1, false],
                ['known', 3, 'not his', 3, false],
                ['known', 3, 'unknown', 4, false],
                ['unknown', 2, 'not his', 1, false],
              ]
            : []),
          ['unknown', 2, 'unknown', 4, false],
        ])(
          'for %s userId - %s, and %s document id - %s',
          (
            _,
            userId: number,
            _2,
            documentId: number,
            shouldGainAccess: boolean,
          ) => {
            if (databaseShouldBeAvailable) {
              if (shouldGainAccess) {
                it('should remove selected document from database and return nothing', async () => {
                  const expectedDocumentsLeft = [
                    fixtures.firstDocument,
                    fixtures.secondDocument,
                    fixtures.thirdDocument,
                  ].filter((doc) => doc.id !== documentId);

                  expect(expectedDocumentsLeft).toHaveLength(2);
                  expect(
                    expectedDocumentsLeft.map((doc) => doc.id!),
                  ).not.toContain(documentId);

                  await expect(
                    service.remove(documentId, userId),
                  ).resolves.toBeUndefined();

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    expectedDocumentsLeft,
                    true,
                    dataSource,
                  );
                });
              } else {
                it('should not alter database and throw error with correct message', async () => {
                  await expect(
                    service.remove(documentId, userId),
                  ).rejects.toThrow(
                    `Cannot remove document from database, unknown document id #${documentId} or userId #${userId}`,
                  );

                  await utils.expectDatabaseDocumentsState(
                    constants.databasePath,
                    constants.databaseDocumentsDir,
                    databaseShouldContainDocuments
                      ? [
                          fixtures.firstDocument,
                          fixtures.secondDocument,
                          fixtures.thirdDocument,
                        ]
                      : [],
                    true,
                    dataSource,
                  );
                });
              }
            } else {
              it('should not alter database and throw error with correct message', async () => {
                await expect(
                  service.remove(documentId, userId),
                ).rejects.toThrow(
                  'Connection with sqlite database is not established. Check connection configuration.',
                );

                await utils.expectDatabaseDocumentsState(
                  constants.databasePath,
                  constants.databaseDocumentsDir,
                  databaseShouldContainDocuments
                    ? [
                        fixtures.firstDocument,
                        fixtures.secondDocument,
                        fixtures.thirdDocument,
                      ]
                    : [],
                  false,
                  dataSource,
                );
              });
            }
          },
        );
      });
    });
  });
});
