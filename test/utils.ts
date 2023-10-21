import { Document } from '../src/modules/documents/entities/document.entity';
import { DataSource } from 'typeorm';
import { readdir, readFile } from 'node:fs/promises';

async function newMulterFile(
  directory: string,
  fileName: string,
): Promise<Express.Multer.File> {
  return {
    fieldname: 'file',
    originalname: fileName,
    encoding: '7bit',
    mimetype: 'application/pdf', // TODO: fix this for than pdf, .md and other files
    size: 7926, // TODO: fix this for other files than pdf
    stream: undefined!,
    destination: undefined!,
    filename: undefined!,
    path: undefined!,
    buffer: await readFile(directory + '/' + fileName),
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

async function fileEquals(filePath: string, buffer: Buffer): Promise<boolean> {
  const file: Buffer = await readFile(filePath);
  return Buffer.compare(file, buffer) === 0;
}

async function newDataSource(path: string): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: path,
    entities: [Document],
  });

  await dataSource.initialize();
  return dataSource;
}

export interface TestDocument {
  id?: number;
  name?: string;
  path?: string;
  keys?: string;
  file?: Express.Multer.File;
}

export interface TestFixtures {
  firstDocument: TestDocument;
  secondDocument: TestDocument;
  uploadedFile?: Express.Multer.File;
}

async function expectDatabaseDocumentsRepositoryState(
  databasePath: string,
  databaseShouldContain: TestDocument[],
  databaseShouldBeAvailable: boolean,
  dataSource: DataSource,
) {
  let availableDataSource = dataSource;
  if (!databaseShouldBeAvailable) {
    expect(dataSource.isInitialized).toBeFalsy();
    availableDataSource = await newDataSource(databasePath);
  }
  expect(availableDataSource.isInitialized).toBeTruthy();

  const documentsRepository = availableDataSource.getRepository(Document);
  await expect(documentsRepository.find()).resolves.toStrictEqual(
    databaseShouldContain.map((testDocument) =>
      newDocument(testDocument.id!, testDocument.name!, testDocument.keys!),
    ),
  );
}

async function expectDatabaseDocumentsDirState(
  databaseDocumentsDir: string,
  databaseShouldContain: TestDocument[],
) {
  await expect(readdir(databaseDocumentsDir)).resolves.toStrictEqual(
    databaseShouldContain.map((testDocument) => testDocument.name),
  );

  for (const testDocument of databaseShouldContain) {
    await expect(
      filesEqual(
        testDocument.path!,
        `${databaseDocumentsDir}/${testDocument.name}`,
      ),
    ).resolves.toBeTruthy();
  }
}

async function expectDatabaseDocumentsState(
  databasePath: string,
  databaseDocumentsDir: string,
  databaseShouldContain: TestDocument[],
  databaseShouldBeAvailable: boolean,
  dataSource: DataSource,
) {
  await expectDatabaseDocumentsRepositoryState(
    databasePath,
    databaseShouldContain,
    databaseShouldBeAvailable,
    dataSource,
  );

  await expectDatabaseDocumentsDirState(
    databaseDocumentsDir,
    databaseShouldContain,
  );
}

export default {
  newMulterFile,
  newDocument, // TODO: remove it
  filesEqual, // TODO: remove it
  fileEquals,
  expectDatabaseDocumentsState,
};
