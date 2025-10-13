// @ts-nocheck
/* eslint-disable import/no-anonymous-default-export */

import path from 'node:path';

const lint = (filenames) => {
  const files = filenames.map((f) => path.relative(process.cwd(), f)).join(' ');
  return `pnpm --filter dapp exec eslint --fix ${files}`;
};

const prettier = (filenames) => {
  const files = filenames
    .map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'))
    .join(' ');
  return `pnpm exec prettier --write ${files} --cache`;
};

const solhint = (filenames) => {
  const files = filenames
    .map((f) => path.relative(process.cwd(), f).replace(/\\/g, '/'))
    .join(' ');
  return `pnpm --filter contracts exec solhint ${files} --fix`;
};

export default {
  // Dapp files
  'apps/dapp/**/*.{ts,tsx}': () => 'pnpm --filter dapp typecheck',
  'apps/dapp/**/*.{html,css,scss,js,jsx,cjs,mjs,ts,tsx,mdx}': [prettier],
  'apps/dapp/**/*.{js,jsx,ts,tsx}': [lint],

  // Contracts files
  'packages/contracts/**/*.{ts,js}': [prettier],
  'packages/contracts/**/*.sol': [solhint, prettier],
  'packages/contracts/**/*.ts': () => 'pnpm --filter contracts typecheck',
};
