import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { DataSource } from 'typeorm';
import { unlink, readdir, readFile, rm, mkdir } from 'node:fs/promises';

interface Fixtures {
  documentId?: number;
  documentName?: string;
  uploadedFile?: Express.Multer.File;
  keys?: string;
}

interface Constants {
  databaseDir: string;
  databasePath: string;
  databaseDocumentsDir: string;

  testDataDir: string;
  testDocumentsDir: string;
  testDocumentName: string;
  testDocumentPath: string;
}

const constants: Constants = {
  databaseDir: 'database',
  databasePath: 'database/documents-service-test.sqlite',
  databaseDocumentsDir: 'database/documents',

  testDataDir: 'test/data',
  testDocumentsDir: 'test/data/documents',
  testDocumentName: 'sample-document.pdf',
  testDocumentPath: 'test/data/documents' + '/' + 'sample-document.pdf',
};

async function mockedUploadedFile(): Promise<Express.Multer.File> {
  return {
    fieldname: 'file',
    originalname: constants.testDocumentName,
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: 7926,
    stream: undefined!,
    destination: undefined!,
    filename: undefined!,
    path: undefined!,
    buffer: await readFile(constants.testDocumentPath),
  };
}

function newDocument(
  id: Document['id'],
  name: Document['name'],
  keys: Document['keys'],
): Document {
  const document = new Document();
  document.id = id;
  document.name = name;
  document.keys = keys;
  return document;
}

async function filesEqual(
  filePath_1: string,
  filePath_2: string,
): Promise<boolean> {
  const file_1: Buffer = await readFile(filePath_1);
  const file_2: Buffer = await readFile(filePath_2);
  return Buffer.compare(file_1, file_2) === 0;
}

describe('DocumentsService', () => {
  const fixtures: Fixtures = {};

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

  describe('with no data stored', () => {
    it('database documents repository should be empty', async () => {
      const documentsRepository = dataSource.getRepository(Document);
      await expect(documentsRepository.count()).resolves.toBe(0);
    });

    describe('with database available', () => {
      describe('findAll()', () => {
        it('should return empty array', async () => {
          await expect(service.findAll()).resolves.toStrictEqual([]);
        });
      });

      describe('findOne()', () => {
        describe('for not existing document id', () => {
          it('should return null', async () => {
            fixtures.documentId = 1;

            await expect(
              service.findOne(fixtures.documentId),
            ).resolves.toBeNull();
          });
        });
      });

      describe('create()', () => {
        describe('for correct document data', () => {
          it('should save new document to database', async () => {
            fixtures.documentName = 'uploaded-document-random-name.pdf';
            fixtures.uploadedFile = await mockedUploadedFile();
            fixtures.keys = 'nannanannnana';

            await expect(
              service.create(
                fixtures.documentName,
                fixtures.uploadedFile,
                fixtures.keys,
              ),
            ).resolves.toBeUndefined();

            const documentsRepository = dataSource.getRepository(Document);
            await expect(documentsRepository.find()).resolves.toStrictEqual([
              newDocument(1, fixtures.documentName, fixtures.keys),
            ]);
            await expect(
              readdir(constants.databaseDocumentsDir),
            ).resolves.toStrictEqual([fixtures.documentName]);

            await expect(
              filesEqual(
                constants.testDocumentPath,
                `${constants.databaseDocumentsDir}/${fixtures.documentName}`,
              ),
            ).resolves.toBeTruthy();
          });
        });
      });

      describe('remove()', () => {
        describe('for not existing document it', () => {
          it('should throw error', async () => {
            fixtures.documentId = 1;

            await expect(service.remove(fixtures.documentId)).rejects.toBe(
              `Cannot remove document from database, unknown id #${fixtures.documentId}`,
            );
          });
        });
      });
    });

    describe('with database not available', () => {
      // TODO
    });
  });

  describe('with data stored', () => {
    beforeEach(async () => {
      fixtures.documentName = 'uploaded-document-random-name.pdf';
      fixtures.uploadedFile = await mockedUploadedFile();
      fixtures.keys = 'nannanannnana';

      await service.create(
        fixtures.documentName,
        fixtures.uploadedFile,
        fixtures.keys,
      );

      fixtures.documentId = 1;
    });

    it('database should store one document', async () => {
      const documentsRepository = dataSource.getRepository(Document);
      await expect(documentsRepository.count()).resolves.toBe(1);
    });

    it('stored document should have id #1', async () => {
      const documentsRepository = dataSource.getRepository(Document);
      const documents = await documentsRepository.find();
      expect(documents[0].id).toBe(fixtures.documentId);
    });

    describe('with database available', () => {
      describe('findAll()', () => {
        it('should return array with stored document', async () => {
          await expect(service.findAll()).resolves.toStrictEqual([
            newDocument(
              fixtures.documentId!,
              fixtures.documentName!,
              fixtures.keys!,
            ),
          ]);
        });
      });

      describe('findOne()', () => {
        describe('for correct document id', () => {
          it('should return stored document', async () => {
            await expect(
              service.findOne(fixtures.documentId!),
            ).resolves.toStrictEqual(
              newDocument(
                fixtures.documentId!,
                fixtures.documentName!,
                fixtures.keys!,
              ),
            );
          });
        });

        describe('for unknown document id', () => {
          it('should return null', async () => {
            const incorrectId = 942;
            expect(incorrectId).not.toBe(fixtures.documentId!);
            await expect(service.findOne(incorrectId)).resolves.toBeNull();
          });
        });
      });

      describe('create()', () => {
        describe('for new document with exactly the same content', () => {
          it('should save new document to database and not reuse already stored file', async () => {
            // TODO: this test makes sure we do not reuse stored files but
            // actually we could and probably should reuse those files so
            // change spec (tests) and implement files reusage.
            // (if someone creates same file twice but for different names,
            //  in databaseDocumentsDir we should have only one file to save space)
            const newDocumentName = fixtures.documentName + '-2';
            expect(newDocumentName).not.toBe(fixtures.documentName);

            await expect(
              service.create(
                newDocumentName,
                fixtures.uploadedFile!,
                fixtures.keys!,
              ),
            ).resolves.toBeUndefined();

            const documentsRepository = dataSource.getRepository(Document);
            await expect(documentsRepository.find()).resolves.toStrictEqual([
              newDocument(
                fixtures.documentId!,
                fixtures.documentName!,
                fixtures.keys!,
              ),
              newDocument(
                fixtures.documentId! + 1,
                newDocumentName!,
                fixtures.keys!,
              ),
            ]);

            await expect(
              readdir(constants.databaseDocumentsDir),
            ).resolves.toStrictEqual([fixtures.documentName, newDocumentName]);

            await expect(
              filesEqual(
                `${constants.databaseDocumentsDir}/${fixtures.documentName}`,
                `${constants.databaseDocumentsDir}/${newDocumentName}`,
              ),
            ).resolves.toBeTruthy();
          });
        });

        describe('for new document with same name as existing one', () => {
          it('should throw error explaining that document name is already taken', async () => {
            // NOTE: this could cause huge time/performance costs if frontend handles this error incorrectly.
            // Frontend performs encryption and if the file was large (took long time to encrypt) failure on sending it to server
            // just because name is already taken should not result in dropping such encrypted file.
            // Make sure frontend does not immediately remove encrypted file upon receiving this error so that
            // user can just give a different name to the file and upload it again.
            // NOTE: also, controller or frontend could first check if the name is available and then upload it
            // to avoid waisting bandwith and time.

            await expect(
              service.create(
                fixtures.documentName!,
                fixtures.uploadedFile!,
                fixtures.keys!,
              ),
            ).rejects.toBe(
              `Cannot create document because name already exists: ${fixtures.documentName}`,
            );
          });

          it('should not change anything in database', async () => {
            await expect(
              service.create(
                fixtures.documentName!,
                fixtures.uploadedFile!,
                fixtures.keys!,
              ),
            ).rejects.toBe(
              `Cannot create document because name already exists: ${fixtures.documentName}`,
            );

            const documentsRepository = dataSource.getRepository(Document);
            await expect(documentsRepository.count()).resolves.toBe(1);
            await expect(
              documentsRepository.findBy({ id: fixtures.documentId }),
            ).resolves.toStrictEqual([
              newDocument(
                fixtures.documentId!,
                fixtures.documentName!,
                fixtures.keys!,
              ),
            ]);
          });
        });
      });

      describe('remove()', () => {
        describe('for correct document id', () => {
          it('should remove document from database', async () => {
            await expect(
              service.remove(fixtures.documentId!),
            ).resolves.toBeUndefined();

            const documentsRepository = dataSource.getRepository(Document);
            await expect(documentsRepository.count()).resolves.toBe(0);

            await expect(
              readdir(constants.databaseDocumentsDir),
            ).resolves.toStrictEqual([]);
          });
        });

        describe('for unknown document id', () => {
          it('should throw an error explaining that id is unknown', async () => {
            const incorrectId = fixtures.documentId! + 1;
            expect(fixtures.documentId).not.toBe(incorrectId);

            await expect(service.remove(incorrectId)).rejects.toBe(
              `Cannot remove document from database, unknown id #${incorrectId}`,
            );

            const documentsRepository = dataSource.getRepository(Document);
            await expect(documentsRepository.find()).resolves.toStrictEqual([
              newDocument(
                fixtures.documentId!,
                fixtures.documentName!,
                fixtures.keys!,
              ),
            ]);
            await expect(
              readdir(constants.databaseDocumentsDir),
            ).resolves.toStrictEqual([fixtures.documentName]);
          });
        });
      });
    });

    describe('with database not available', () => {
      // TODO
    });
  });
});
