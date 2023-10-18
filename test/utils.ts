import { Document } from '../src/modules/documents/entities/document.entity';
import { readFile } from 'node:fs/promises';
import { DataSource } from 'typeorm';

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

export async function newDataSource(path: string): Promise<DataSource> {
  const dataSource = new DataSource({
    type: 'sqlite',
    database: path,
    entities: [Document],
  });

  await dataSource.initialize();
  return dataSource;
}

export default {
  newDocument,
  filesEqual,
  newDataSource,
};
