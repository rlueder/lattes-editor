/**
 * Lançamentos com semantic-release, a cada push na main.
 *
 * A versão sai dos tipos dos commits (Conventional Commits):
 *   - quebra (rodapé BREAKING CHANGE) → maior
 *   - feat → menor
 *   - fix, perf, refactor, revert → correção
 *   - docs, style, test, ci, chore, build → sem lançamento
 *
 * Em cada lançamento: notas em pt-BR, CHANGELOG.md atualizado, versão no
 * package.json, tag, e a página do GitHub com a extensão em .zip, construída
 * já com a versão nova. Os instaladores do app vêm depois, pelo
 * desktop-build.yml. O editor só se distribui como app de desktop, nunca como
 * um HTML solto.
 */

const presetConfig = {
  types: [
    { type: 'feat', section: 'Novidades' },
    { type: 'fix', section: 'Correções' },
    { type: 'perf', section: 'Desempenho' },
    { type: 'refactor', section: 'Reorganização do código' },
    { type: 'revert', section: 'Reversões' },
    { type: 'docs', hidden: true },
    { type: 'style', hidden: true },
    { type: 'test', hidden: true },
    { type: 'ci', hidden: true },
    { type: 'chore', hidden: true },
    { type: 'build', hidden: true },
  ],
};

// A quebra vem primeiro: o analisador usa estas regras antes das padrão, e
// sem ela um feat com BREAKING CHANGE sairia como versão menor.
const releaseRules = [
  { breaking: true, release: 'major' },
  { type: 'feat', release: 'minor' },
  { type: 'fix', release: 'patch' },
  { type: 'perf', release: 'patch' },
  { type: 'refactor', release: 'patch' },
  { type: 'revert', release: 'patch' },
  { type: 'docs', release: false },
  { type: 'style', release: false },
  { type: 'test', release: false },
  { type: 'ci', release: false },
  { type: 'chore', release: false },
  { type: 'build', release: false },
];

const BUILD = [
  // O CHANGELOG gerado sai no formato do Prettier, senão o format:check reprova o push seguinte.
  'pnpm exec prettier --write CHANGELOG.md',
  'pnpm build:extension',
  'mkdir -p release',
  '(cd dist-extension && zip -qr ../release/lattes-editor-extensao.zip .)',
  // O mesmo pacote sem a chave do manifest, para enviar à Chrome Web Store.
  'pnpm build:extension:loja',
  '(cd dist-extension-loja && zip -qr ../release/lattes-editor-extensao-loja.zip .)',
].join(' && ');

module.exports = {
  branches: ['main'],
  plugins: [
    ['@semantic-release/commit-analyzer', { preset: 'conventionalcommits', releaseRules }],
    ['@semantic-release/release-notes-generator', { preset: 'conventionalcommits', presetConfig }],
    [
      '@semantic-release/changelog',
      { changelogFile: 'CHANGELOG.md', changelogTitle: '# Changelog' },
    ],
    // Só sobe a versão do package.json; o pacote não vai para o npm.
    ['@semantic-release/npm', { npmPublish: false }],
    // Constrói depois da versão nova, para o manifest da extensão levar o número certo.
    ['@semantic-release/exec', { prepareCmd: BUILD }],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md', 'package.json'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: [
          { label: 'Extensão do conector (.zip)', path: 'release/lattes-editor-extensao.zip' },
          {
            label: 'Extensão do conector para a Chrome Web Store (.zip)',
            path: 'release/lattes-editor-extensao-loja.zip',
          },
        ],
        failComment: false,
        releasedLabels: false,
        successCommentCondition: false,
      },
    ],
  ],
};
