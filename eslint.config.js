// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Apps must not import each other's source; shared code lives in @genialtanken/contracts.
 * @param {string} forbiddenApp
 */
const forbiddenAppImportPattern = forbiddenApp => ({
  group: [`**/apps/${forbiddenApp}/**`, `${forbiddenApp}/*`],
  message: `Do not import from apps/${forbiddenApp}. Share code via @genialtanken/contracts.`,
});

/** @param {string} forbiddenApp */
const forbidImportsFrom = forbiddenApp => ({
  'no-restricted-imports': ['error', { patterns: [forbiddenAppImportPattern(forbiddenApp)] }],
});

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.angular/**',
      '**/node_modules/**',
      'e2e/playwright-report/**',
      'e2e/test-results/**',
      // Git worktrees of parallel coding agents
      '.claude/worktrees/**',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ['packages/contracts/vitest.config.ts'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
      // Angular and Nest classes are configured entirely through decorators
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [eslint.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    languageOptions: { globals: globals.browser },
    rules: {
      ...forbidImportsFrom('api'),
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
    },
  },
  {
    // The deploy bundles functions/ without node_modules, so only specs may use contracts.
    // Flat config replaces rule options instead of merging them, hence the API pattern again.
    files: ['apps/web/functions/**/*.ts'],
    ignores: ['**/*.spec.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@genialtanken/contracts',
              message:
                'Pages Functions are deployed without node_modules. Duplicate the value and keep it in sync through a spec.',
            },
          ],
          patterns: [
            forbiddenAppImportPattern('api'),
            {
              group: ['@genialtanken/contracts/*'],
              message: 'Pages Functions are deployed without node_modules.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/web/**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
  },
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      ...forbidImportsFrom('web'),
      // Nest relies on runtime class references for dependency injection
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.vitest } },
  }
);
