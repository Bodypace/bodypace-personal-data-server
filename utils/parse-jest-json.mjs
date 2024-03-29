#!/usr/bin/env node
import fs from 'node:fs/promises';

const dataRaw = await fs.readFile(process.argv[2], { encoding: 'utf-8' });
const data = JSON.parse(dataRaw);

data.testResults
  .sort((a, b) => (a.name < b.name ? -1 : 1))
  .forEach((test) => {
    printTestResult(test);
  });

printSummary(data);

function printTestResult(test) {
  const stack = [];
  const print = (message) =>
    console.log('  '.repeat(stack.length + 1) + message);

  console.log(
    test.status.toUpperCase(),
    test.name.replace(process.cwd() + '/', ''),
  );

  test.assertionResults.forEach(({ ancestorTitles: titles, title, status }) => {
    const diffIndex = indexOfFirstDiff(stack, titles);
    stack.splice(diffIndex);
    for (let i = diffIndex; i < titles.length; ++i) {
      print(titles[i]);
      stack.push(titles[i]);
    }
    const mark = status === 'passed' ? '✓' : 'x';
    print(mark + ' ' + title);
  });
}

// example: indexOfFirstDiff(['A', 'B', 'C', 'D'], ['A', 'B', 'X', 'Y'])
// returns: 2 (this will also always be the len of the common part (1 if both arrays are empty))
function indexOfFirstDiff(array_a, array_b) {
  const maxLen = Math.min(array_a.length, array_b.length);
  for (let i = 0; i < maxLen; ++i) {
    if (array_a[i] !== array_b[i]) {
      return i;
    }
  }
  return maxLen;
}

function printSummary(data) {
  console.log();
  console.log(
    'Test Suites:',
    data.numPassedTestSuites,
    'passed,',
    data.numTotalTestSuites,
    'total,',
    data.numFailedTestSuites,
    'failed,',
    data.numPendingTestSuites,
    'pending,',
    data.numRuntimeErrorTestSuites,
    'runtime error',
  );
  console.log(
    'Tests:',
    data.numPassedTests,
    'passed,',
    data.numTotalTests,
    'total,',
    data.numFailedTests,
    'failed,',
    data.numPendingTests,
    'pending,',
    data.numTodoTests,
    'todo',
  );

  const snapshot = [
    'failure',
    'didUpdate',
    'total',
    'matched',
    'updated',
    'added',
    'unchecked',
    'unmatched',
    'filesAdded',
    'filesRemoved',
    'filesUnmatched',
    'filesUpdated',
  ];

  console.log(
    'Snapshots:',
    snapshot.map((key) => [data.snapshot[key], key]),
  );
  console.log(
    'Success:',
    data.success,
    '(was interrupted:',
    data.wasInterrupted,
    ')',
  );
  console.log(
    'note: this entire log was generated by script from `jest --json` output',
  );
}
