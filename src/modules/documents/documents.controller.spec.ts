import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from './entities/document.entity';
import { readFile, copyFile, unlink, rm, mkdir } from 'node:fs/promises';
import type { Response } from 'express';
import { createReadStream } from 'node:fs';
import { NotFoundException, StreamableFile } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TestDocument } from 'test/utils';

interface Constants {
  databasePath: string;
  databaseDocumentsDir: string;

  testDataDir: string;
  testDocumentsDir: string;
  testDocumentName: string;
  testDocumentPath: string;

  jwtSecret: string;
}

// NOTE: now tests need to be run with --runInBand for them to work.
// TODO: fix database path and documents path being not configurable in Service, as this causes tests race conditions.
// NOTE: also, test for race conditions when there are multiple requests at once for the same file?
const constants: Constants = {
  databasePath: 'database/documents-controller-test.sqlite',
  databaseDocumentsDir: 'database/documents',

  testDataDir: 'test/data',
  testDocumentsDir: 'test/data/documents',
  testDocumentName: 'sample-document.pdf',
  testDocumentPath: 'test/data/documents' + '/' + 'sample-document.pdf',

  jwtSecret:
    'DO NOT USE THIS VALUE. INSTEAD, CREATE A COMPLEX SECRET AND KEEP IT SAFE OUTSIDE OF THE SOURCE CODE.',
};

interface Mocks {
  documentsService: {
    create: string;
    findAll: string;
    findOne: {
      name: string;
      userId: number;
    };
  };
  correctDocumentId: number;
  incorrectDocumentid: number;
}

const mocks: Mocks = {
  documentsService: {
    create: 'create() call response',
    findAll: 'findAll() call response',
    findOne: {
      name: 'findOne-call-returned-document-with-name.pdf',
      userId: 424242,
    },
  },
  correctDocumentId: 54,
  incorrectDocumentid: 23,
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

function mockedDocumentsService() {
  return {
    storagePath: constants.databaseDocumentsDir,
    create: jest
      .fn()
      .mockImplementation(() => structuredClone(mocks.documentsService.create)),
    findAll: jest
      .fn()
      .mockImplementation(() =>
        structuredClone(mocks.documentsService.findAll),
      ),
    findOne: jest
      .fn()
      .mockImplementation((id: number) =>
        id === mocks.correctDocumentId
          ? structuredClone(mocks.documentsService.findOne)
          : null,
      ),
    remove: jest.fn(),
  };
}

interface Fixtures {
  document?: TestDocument;
}

describe('DocumentsController', () => {
  const fixtures: Fixtures = {};

  let controller: DocumentsController;
  let documentsService: DocumentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: constants.databasePath,
          autoLoadEntities: true,
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Document]),
        JwtModule.register({
          global: true,
          secret: constants.jwtSecret,
          signOptions: {
            expiresIn: '60s',
          },
        }),
      ],
      controllers: [DocumentsController],
      providers: [DocumentsService],
    })
      .overrideProvider(DocumentsService)
      .useValue(mockedDocumentsService())
      .compile();

    controller = module.get<DocumentsController>(DocumentsController);
    documentsService = module.get<DocumentsService>(DocumentsService);
  });

  afterEach(async () => {
    await unlink(constants.databasePath);
    await rm(constants.databaseDocumentsDir, { recursive: true });
    await mkdir(constants.databaseDocumentsDir);

    fixtures.document = {};
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('documentsService should be defined', () => {
    expect(documentsService).toBeDefined();
  });

  describe('create()', () => {
    it('should call documentsService#create() with received data and forward result', async () => {
      fixtures.document = {
        name: 'some-random-document-name.pdf',
        keys: 'encrypted-key-that-was-used-to-encrypt-document',
        file: await mockedUploadedFile(),
        userId: 4224,
      };

      await expect(
        controller.create(
          {
            name: fixtures.document.name!,
            keys: fixtures.document.keys!,
          },
          fixtures.document.file!,
          'multipart/form-data; boundary=',
          { user: { sub: fixtures.document.userId } },
        ),
      ).resolves.toStrictEqual(mocks.documentsService.create);

      expect(documentsService.create).toHaveBeenCalledTimes(1);
      expect(documentsService.create).toHaveBeenNthCalledWith(
        1,
        fixtures.document.name,
        fixtures.document.file,
        fixtures.document.keys,
        fixtures.document.userId,
      );
    });
  });

  describe('findAll()', () => {
    it('should call documentsService#findAll() with received data and forward result', async () => {
      fixtures.document = {
        userId: 4224,
      };

      await expect(
        controller.findAll({ user: { sub: fixtures.document.userId } }),
      ).resolves.toStrictEqual(mocks.documentsService.findAll);

      expect(documentsService.findAll).toHaveBeenCalledTimes(1);
      expect(documentsService.findAll).toHaveBeenNthCalledWith(
        1,
        fixtures.document.userId,
      );
    });
  });

  describe('findOne()', () => {
    describe('for correct document id', () => {
      beforeEach(async () => {
        await mkdir(
          `${constants.databaseDocumentsDir}/${mocks.documentsService.findOne.userId}`,
          { recursive: true },
        );
        await copyFile(
          constants.testDocumentPath,
          `${constants.databaseDocumentsDir}/${mocks.documentsService.findOne.userId}/${mocks.documentsService.findOne.name}`,
        );
      });

      it('should call documentsService#findOne() with received data, set header accordingly to returned document and return StreamableFile ', async () => {
        fixtures.document = {
          id: mocks.correctDocumentId,
          userId: 4224,
        };

        const res = {
          set: jest.fn(),
        } as any as Response;

        const expectedResult = new StreamableFile(
          createReadStream(
            `${constants.databaseDocumentsDir}/${mocks.documentsService.findOne.userId}/${mocks.documentsService.findOne.name}`,
          ),
        );
        const receivedResult = await controller.findOne(
          String(fixtures.document.id),
          { user: { sub: fixtures.document.userId } },
          res,
        );

        expect(JSON.parse(JSON.stringify(receivedResult))).toStrictEqual(
          JSON.parse(JSON.stringify(expectedResult)),
        );

        expect(res.set).toHaveBeenCalledTimes(1);
        expect(res.set).toHaveBeenNthCalledWith(1, {
          'Content-Disposition': `attachment; filename="${mocks.documentsService.findOne.name}"`,
        });

        expect(documentsService.findOne).toHaveBeenCalledTimes(1);
        expect(documentsService.findOne).toHaveBeenNthCalledWith(
          1,
          fixtures.document.id,
          fixtures.document.userId,
        );
      });
    });

    describe('for unknown document id', () => {
      it('should call documentsService#findOne() with received data and for null response throw NotFoundException (404)', async () => {
        fixtures.document = {
          id: mocks.incorrectDocumentid,
          userId: 4224,
        };

        const res = {
          set: jest.fn(),
        } as any as Response;

        await expect(
          controller.findOne(
            String(fixtures.document.id),
            { user: { sub: fixtures.document.userId } },
            res,
          ),
        ).rejects.toThrow(NotFoundException);

        expect(res.set).toHaveBeenCalledTimes(0);

        expect(documentsService.findOne).toHaveBeenCalledTimes(1);
        expect(documentsService.findOne).toHaveBeenNthCalledWith(
          1,
          fixtures.document.id,
          fixtures.document.userId,
        );
      });
    });
  });

  describe('remove()', () => {
    it('should call documentsService#remove() with received data and forward result', async () => {
      fixtures.document = {
        id: mocks.correctDocumentId,
        userId: 4224,
      };

      await expect(
        controller.remove(String(fixtures.document.id), {
          user: { sub: fixtures.document.userId },
        }),
      ).resolves.toBeUndefined();

      expect(documentsService.remove).toHaveBeenCalledTimes(1);
      expect(documentsService.remove).toHaveBeenNthCalledWith(
        1,
        fixtures.document.id,
        fixtures.document.userId,
      );
    });

    // TODO: tests for idempotence (and actually implement idempotence)
    // TODO: e2e tests for this controller
    // (useful link: https://github.com/nestjs/nest/tree/master/sample/29-file-upload)
  });
});
