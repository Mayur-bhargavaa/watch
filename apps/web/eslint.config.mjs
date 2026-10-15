// Focused lint config: catches real bugs (hook misuse, unhandled promises, dead code, swallowed errors)
// rather than style. Run with: npm run lint -w @synccinema/web
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'public/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { project: './tsconfig.json', tsconfigRootDir: import.meta.dirname }
    },
    plugins: { '@typescript-eslint': tseslint.plugin, 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-floating-promises': ['error', { ignoreVoid: true }],
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: false }],
      eqeqeq: ['warn', 'smart'],
      'no-self-assign': 'error',
      'no-unreachable': 'error',
      'no-dupe-else-if': 'error'
    }
  },
  {
    // node:test registers tests by calling test(...), which returns a promise that must not be awaited
    files: ['src/**/__tests__/**/*.ts'],
    rules: { '@typescript-eslint/no-floating-promises': 'off' }
  }
);
