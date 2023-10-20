import { Document } from '../src/modules/documents/entities/document.entity';
import { readFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';
import { readdir } from 'node:fs/promises';

export function newDocument(
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

export async function filesEqual(
  filePath_1: string,
  filePath_2: string,
): Promise<boolean> {
  const file_1: Buffer = await readFile(filePath_1);
  const file_2: Buffer = await readFile(filePath_2);
  return Buffer.compare(file_1, file_2) === 0;
}

export async function fileEquals(
  filePath: string,
  buffer: Buffer,
): Promise<boolean> {
  const file: Buffer = await readFile(filePath);
  return Buffer.compare(file, buffer) === 0;
}

export async function newDataSource(path: string): Promise<DataSource> {
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
}

export interface TestFixtures {
  firstDocument: TestDocument;
  secondDocument: TestDocument;
  uploadedFile?: Express.Multer.File;
}

export async function expectDatabaseDocumentsState(
  databasePath: string,
  databaseDocumentsDir: string,
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

export default {
  newDocument,
  filesEqual,
  fileEquals,
  newDataSource,
  expectDatabaseWasNotAltered: expectDatabaseDocumentsState,
};
