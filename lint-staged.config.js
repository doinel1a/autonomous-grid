// @ts-nocheck
/* eslint-disable import/no-anonymous-default-export */

import path from 'node:path';

const tsc = () => 'tsc --noEmit';

const eslint = (filenames) => {
  const files = filenames.map((f) => path.relative(process.cwd(), f)).join(' ');
  return [`eslint --fix ${files}`, `eslint --max-warnings=0 ${files}`];
};

const prettier = (filenames) =>
  `prettier --write ${filenames.map((f) => path.relative(process.cwd(), f)).join(' ')} --cache`;

export default {
  '*.{ts,tsx}': [tsc],
  '*.{js,jsx,ts,tsx}': [eslint],
  '*.{html,css,scss,js,jsx,cjs,mjs,ts,tsx,mdx}': [prettier]
};
