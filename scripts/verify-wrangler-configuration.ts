/**
 * Checks the trusted apps/web/wrangler.jsonc before deploy-web.yml runs wrangler with the deploy
 * secrets: a `build` section (top level or per environment) would make wrangler run a shell
 * command, and the Worker name must be the production one.
 *
 * deploy-web.yml checks this script out from the default branch only, never from a pull request.
 * It runs without dependencies (Node strips the types natively):
 *
 *   node scripts/verify-wrangler-configuration.ts apps/web/wrangler.jsonc
 */
import { readFileSync } from 'node:fs';

const EXPECTED_WORKER_NAME = 'genialtanken';

/** Index just after the string literal that starts at `start`, honoring backslash escapes. */
function endOfStringLiteral(text: string, start: number): number {
  let index = start + 1;
  while (index < text.length && text.charAt(index) !== '"') {
    index += text.charAt(index) === '\\' ? 2 : 1;
  }
  return index + 1;
}

/** Removes `//` and block comments outside of strings, because URLs inside strings contain `//`. */
export function stripJsonComments(text: string): string {
  let withoutComments = '';
  let index = 0;
  while (index < text.length) {
    const character = text.charAt(index);
    const nextCharacter = text.charAt(index + 1);
    if (character === '"') {
      const end = endOfStringLiteral(text, index);
      withoutComments += text.slice(index, end);
      index = end;
    } else if (character === '/' && nextCharacter === '/') {
      const end = text.indexOf('\n', index);
      withoutComments += '\n';
      index = end === -1 ? text.length : end + 1;
    } else if (character === '/' && nextCharacter === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 2;
    } else {
      withoutComments += character;
      index += 1;
    }
  }
  return withoutComments;
}

/** Removes commas before `}` or `]` outside of strings; expects text without comments. */
export function stripTrailingCommas(text: string): string {
  let withoutTrailingCommas = '';
  let index = 0;
  while (index < text.length) {
    const character = text.charAt(index);
    if (character === '"') {
      const end = endOfStringLiteral(text, index);
      withoutTrailingCommas += text.slice(index, end);
      index = end;
      continue;
    }
    const isTrailingComma = character === ',' && /^\s*[}\]]/.test(text.slice(index + 1));
    if (!isTrailingComma) {
      withoutTrailingCommas += character;
    }
    index += 1;
  }
  return withoutTrailingCommas;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns one message per problem; an empty list means the configuration may be deployed. */
export function findWranglerConfigurationProblems(text: string): string[] {
  const withoutTrailingCommas = stripTrailingCommas(stripJsonComments(text));
  let configuration: unknown;
  try {
    configuration = JSON.parse(withoutTrailingCommas);
  } catch (error) {
    return [`wrangler.jsonc is not valid JSONC: ${error instanceof Error ? error.message : ''}`];
  }
  if (!isRecord(configuration)) {
    return ['wrangler.jsonc must contain an object.'];
  }

  const problems: string[] = [];
  const environments = isRecord(configuration['env']) ? Object.entries(configuration['env']) : [];
  const sectionsWithBuild = [
    ...('build' in configuration ? ['top level'] : []),
    ...environments
      .filter(([, environment]) => isRecord(environment) && 'build' in environment)
      .map(([name]) => `env.${name}`),
  ];
  if (sectionsWithBuild.length > 0) {
    problems.push(
      `wrangler.jsonc must not define a build command (${sectionsWithBuild.join(', ')}).`
    );
  }
  if (configuration['name'] !== EXPECTED_WORKER_NAME) {
    problems.push(`Unexpected Worker name '${String(configuration['name'])}' in wrangler.jsonc.`);
  }
  return problems;
}

if (import.meta.main) {
  const configurationPath = process.argv[2];
  if (configurationPath === undefined) {
    console.log('::error::Usage: node scripts/verify-wrangler-configuration.ts <wrangler.jsonc>');
    process.exit(1);
  }
  const problems = findWranglerConfigurationProblems(readFileSync(configurationPath, 'utf8'));
  for (const problem of problems) {
    console.log(`::error::${problem}`);
  }
  process.exit(problems.length > 0 ? 1 : 0);
}
