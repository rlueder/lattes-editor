import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'yaml';

const require = createRequire(import.meta.url);
const configPath = fileURLToPath(new URL('../.releaserc.cjs', import.meta.url));

type ReleaseConfig = { branches: string[]; plugins: unknown[] };
type FirstStable = {
  analyzeCommits: (config: object, context: { lastRelease: { version?: string } }) => string;
  verifyRelease: (config: object, context: { nextRelease: { version: string } }) => void;
};
type ReleaseWorkflow = {
  on: {
    workflow_dispatch: {
      inputs: Record<string, { default?: boolean; required?: boolean; type: string }>;
    };
  };
  jobs: {
    release: {
      if: string;
      steps: { env?: Record<string, string>; run?: string }[];
    };
  };
};

function loadConfig(flag?: string): ReleaseConfig {
  vi.stubEnv('LATTES_PRIMEIRA_ESTAVEL', flag);
  delete require.cache[configPath];
  return require(configPath) as ReleaseConfig;
}

function firstStable(): FirstStable {
  return loadConfig('true').plugins[0] as FirstStable;
}

afterEach(() => {
  vi.unstubAllEnvs();
  delete require.cache[configPath];
});

describe('primeira versão estável', () => {
  it.each([undefined, 'false', 'TRUE', '1'])('preserva a análise normal com a opção %j', (flag) => {
    const config = loadConfig(flag);
    expect(config.branches).toEqual(['main']);
    expect(config.plugins[0]).toEqual([
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: expect.arrayContaining([
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'chore', release: false },
        ]),
      },
    ]);
  });

  it.each(['0.1.0', '0.24.1', '0.999.999'])('seleciona o salto maior depois de %s', (version) => {
    expect(firstStable().analyzeCommits({}, { lastRelease: { version } })).toBe('major');
  });

  it.each([undefined, '', '1.0.0', '1.0.1', '2.0.0', '0.24.1-dev.1', '0.01.0'])(
    'recusa o último lançamento %j',
    (version) => {
      expect(() => firstStable().analyzeCommits({}, { lastRelease: { version } })).toThrow(
        'último lançamento',
      );
    },
  );

  it('confirma exatamente 1.0.0 antes da preparação', () => {
    expect(() =>
      firstStable().verifyRelease({}, { nextRelease: { version: '1.0.0' } }),
    ).not.toThrow();
  });

  it.each(['0.25.0', '1.0.1', '2.0.0', '1.0.0-dev.1'])(
    'impede preparar %s com a opção ligada',
    (version) => {
      expect(() => firstStable().verifyRelease({}, { nextRelease: { version } })).toThrow(
        'só pode criar',
      );
    },
  );

  it('preserva todos os plugins posteriores e o lançamento como rascunho', () => {
    const normal = loadConfig('false');
    const stable = loadConfig('true');
    expect(stable.plugins.slice(1)).toEqual(normal.plugins.slice(1));
    const github = stable.plugins.at(-1) as [string, { draftRelease: boolean }];
    expect(github[0]).toBe('@semantic-release/github');
    expect(github[1].draftRelease).toBe(true);
  });

  it('mantém a escolha manual, desligada por padrão e fora do comando shell', () => {
    const workflow = parse(
      readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8'),
    ) as ReleaseWorkflow;
    expect(Object.keys(workflow.on)).toEqual(['workflow_dispatch']);
    expect(workflow.on.workflow_dispatch.inputs.primeira_estavel).toMatchObject({
      default: false,
      required: false,
      type: 'boolean',
    });
    expect(workflow.jobs.release.if).toBe("github.ref == 'refs/heads/main'");
    const releaseSteps = workflow.jobs.release.steps.filter((step) => step.run === 'pnpm release');
    expect(releaseSteps).toHaveLength(1);
    expect(releaseSteps[0]?.env?.LATTES_PRIMEIRA_ESTAVEL).toBe('${{ inputs.primeira_estavel }}');
  });
});
