import { Document } from '../src/modules/documents/entities/document.entity';
import { Account } from '../src/modules/accounts/modules/database/entities/account.entity';
import { DataSource } from 'typeorm';
import { unlink, rm, mkdir, readdir, readFile } from 'node:fs/promises';

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

  jwtSecretEnvKey: 'BODYPACE_SERVER_JWT_SECRET',
};

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

function newAccount(
  id: Account['id'],
  username: Account['username'],
  password: Account['password'],
): Account {
  const account = new Account();
  account.id = id;
  account.username = username;
  account.password = password;
  return account;
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
    entities: [Document, Account],
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

export interface TestAccount {
  id?: number;
  username?: string;
  password?: string;
}

export interface TestFixtures {
  firstDocument: TestDocument;
  secondDocument: TestDocument;
  uploadedFile?: Express.Multer.File;
}

async function deleteDatabase(
  databasePath: string,
  databaseDocumentsDir: string,
  dataSource: DataSource,
) {
  if (dataSource.isInitialized) {
    await dataSource.destroy();
  }
  await unlink(databasePath);
  await rm(databaseDocumentsDir, { recursive: true });
  await mkdir(databaseDocumentsDir);
}

async function expectDatabaseHasAccounts(
  databasePath: string,
  databaseShouldContain: TestAccount[],
  databaseShouldBeAvailable: boolean,
  dataSource: DataSource,
) {
  let availableDataSource = dataSource;
  if (!databaseShouldBeAvailable) {
    expect(dataSource.isInitialized).toBeFalsy();
    availableDataSource = await newDataSource(databasePath);
  }
  expect(availableDataSource.isInitialized).toBeTruthy();

  const accountsRepository = availableDataSource.getRepository(Account);
  const accounts = await accountsRepository.find();
  for (const account of accounts) {
    account.password = String(account.password.length);
  }

  const passwordHashLength = 60;

  expect(accounts).toStrictEqual(
    databaseShouldContain.map((account) =>
      newAccount(account.id!, account.username!, String(passwordHashLength)),
    ),
  );
}

async function expectDatabaseAccountsRepositoryState(
  databasePath: string,
  databaseShouldContain: TestAccount[],
  databaseShouldBeAvailable: boolean,
  dataSource: DataSource,
) {
  let availableDataSource = dataSource;
  if (!databaseShouldBeAvailable) {
    expect(dataSource.isInitialized).toBeFalsy();
    availableDataSource = await newDataSource(databasePath);
  }
  expect(availableDataSource.isInitialized).toBeTruthy();

  const accountsRepository = availableDataSource.getRepository(Account);
  await expect(accountsRepository.find()).resolves.toStrictEqual(
    databaseShouldContain.map((account) =>
      newAccount(account.id!, account.username!, account.password!),
    ),
  );
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

async function expectDatabaseAccountsState(
  databasePath: string,
  databaseShouldContain: TestAccount[],
  databaseShouldBeAvailable: boolean,
  dataSource: DataSource,
) {
  await expectDatabaseAccountsRepositoryState(
    databasePath,
    databaseShouldContain,
    databaseShouldBeAvailable,
    dataSource,
  );
}

function expectMockedCalls(spec: any[]) {
  for (const [func, calls] of spec) {
    let callNo = 1;
    expect(func).toHaveBeenCalledTimes(calls.length);
    for (const callArgs of calls) {
      expect(func).toHaveBeenNthCalledWith(callNo, ...callArgs);
      ++callNo;
    }
  }
}

export default {
  constants,
  deleteDatabase,
  newMulterFile,
  newDocument, // TODO: remove it
  newAccount,
  filesEqual, // TODO: remove it
  fileEquals,
  expectDatabaseDocumentsState,
  expectDatabaseAccountsState,
  expectDatabaseHasAccounts,
  expectMockedCalls,
};
