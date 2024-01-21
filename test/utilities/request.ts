import * as request from 'supertest';

export const OK = null;
export const MISSING = undefined;

interface ReplacementInfo {
  triggerName: string;
  replacementName: string | typeof OK | typeof MISSING;
  replacementValue: any | typeof OK | typeof MISSING;
}

export function reqField(
  req: request.Test,
  name: string,
  value: any,
  { triggerName, replacementName, replacementValue }: ReplacementInfo,
): request.Test {
  return implementation(req, 'field', name, value, {
    triggerName,
    replacementName,
    replacementValue,
  });
}

export function reqAttach(
  req: request.Test,
  name: string,
  value: any,
  { triggerName, replacementName, replacementValue }: ReplacementInfo,
): request.Test {
  return implementation(req, 'attach', name, value, {
    triggerName,
    replacementName,
    replacementValue,
  });
}

function implementation(
  req: request.Test,
  method: 'field' | 'attach',
  name: string,
  value: any,
  { triggerName, replacementName, replacementValue }: ReplacementInfo,
): request.Test {
  if (name === triggerName) {
    if (replacementName === MISSING) {
      return req;
    }

    return req[method](
      replacementName === OK ? name : replacementName,
      replacementValue === OK ? value : replacementValue,
    );
  }

  return req[method](name, value);
}
