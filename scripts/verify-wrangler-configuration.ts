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

/** Removes `//` and block comments outside of strings, because URLs inside strings contain `//`. */
export function stripJsonComments(text: string): string {
  let withoutComments = '';
  let isInString = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text.charAt(index);
    const nextCharacter = text.charAt(index + 1);
    if (isInString) {
      withoutComments += character;
      if (character === '\\') {
        withoutComments += nextCharacter;
        index += 1;
      } else if (character === '"') {
        isInString = false;
      }
      continue;
    }
    if (character === '"') {
      isInString = true;
      withoutComments += character;
    } else if (character === '/' && nextCharacter === '/') {
      while (index < text.length && text.charAt(index) !== '\n') index += 1;
      withoutComments += '\n';
    } else if (character === '/' && nextCharacter === '*') {
      const end = text.indexOf('*/', index + 2);
      index = end === -1 ? text.length : end + 1;
    } else {
      withoutComments += character;
    }
  }
  return withoutComments;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Returns one message per problem; an empty list means the configuration may be deployed. */
export function findWranglerConfigurationProblems(text: string): string[] {
  const withoutTrailingCommas = stripJsonComments(text).replace(/,(\s*[}\]])/g, '$1');
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
