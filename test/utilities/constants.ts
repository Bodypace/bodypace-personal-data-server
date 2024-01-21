export const constants = {
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
