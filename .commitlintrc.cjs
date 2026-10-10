const base = require('@precisa-saude/commitlint-config');

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  ...base,
  rules: {
    ...base.rules,
    'scope-enum': [
      2,
      'always',
      [
        'model',
        'schema',
        'import-export',
        'forms',
        'lookups',
        'ui',
        'fixtures',
        'docs',
        'ci',
        'deps',
        'config',
      ],
    ],
  },
};
