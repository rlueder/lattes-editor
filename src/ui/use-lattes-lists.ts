// As listas do Lattes que o conector lê na sessão da pessoa (LAT-48,
// src/bridge/lattes-lists.ts): a cópia guardada das áreas e das agências, lida
// ao abrir e renovada quando o conector liga e a cópia passou de um dia; e a
// busca de instituição e os cursos, que dependem do que se escolhe e vão ao
// Lattes a cada pedido. Extensão sem a capacidade 'listas-lattes' não recebe
// pedido nenhum: os campos ficam com a cópia guardada, ou texto livre.

import { useEffect, useMemo, useRef, useState } from 'react';

import type { Agency, AreaNode, Course, Organ } from '../bridge/lattes-lists.ts';
import type { OrganWindowKind } from '../bridge/organ-windows.ts';
import type { BridgeMessage, EditorMessage } from '../bridge/protocol.ts';
import { foldText } from '../model/fold-text.ts';
import { type CachedList, loadCachedList, saveCachedList } from '../model/list-cache.ts';
import { getAttr, type XElement } from '../model/xml.ts';
import type { LattesLists } from './lattes-lists-context.ts';
import {
  institutionAttrs,
  livePairs,
  needsRefresh,
  sameCode,
  withoutLetter,
} from './live-lists.ts';
import { listenReplies, post } from './use-bridge.ts';

const FEATURE = 'listas-lattes';

/** Quanto esperar uma resposta da extensão antes de desistir do pedido. */
const REPLY_TIMEOUT_MS = 20_000;

type Reply = Extract<BridgeMessage, { type: 'cursos' | 'instituicoes' | 'listas' | 'orgaos' }>;

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

export function useLattesLists(features: readonly string[]): LattesLists {
  const live = features.includes(FEATURE);
  // As buscas de orientação e banca: lista de cursos TESE e os ocultos no envio.
  const production = live && features.includes('buscas-producao');
  // A janela de órgãos do projeto, para o órgão e a unidade da participação.
  const organs = live && features.includes('orgao-projeto');
  // A janela de órgãos da atividade, para o órgão e a unidade das atividades.
  const activityOrgans = live && features.includes('orgao-atividades');
  const [areas, setAreas] = useState<CachedList<AreaNode[]>>();
  const [agencies, setAgencies] = useState<CachedList<Agency[]>>();
  const waiting = useRef(new Map<string, (reply: Reply) => void>());
  /** Códigos com a letra, dos resultados de busca desta sessão, pelo código do XML. */
  const fullCodes = useRef(new Map<string, string>());
  const courseCache = useRef(new Map<string, Promise<Course[]>>());

  // A cópia guardada é lida antes de decidir se precisa de leitura nova: sem
  // isso, um conector que liga antes de o banco responder pediria as listas
  // mesmo com a cópia do dia.
  const [cacheLoaded, setCacheLoaded] = useState(false);
  useEffect(() => {
    void Promise.allSettled([
      loadCachedList<AreaNode[]>('areas').then((c) => c && setAreas(c)),
      loadCachedList<Agency[]>('agencias').then((c) => c && setAgencies(c)),
    ]).then(() => setCacheLoaded(true));
  }, []);

  useEffect(
    () =>
      listenReplies((msg) => {
        if (
          msg.type !== 'listas' &&
          msg.type !== 'instituicoes' &&
          msg.type !== 'cursos' &&
          msg.type !== 'orgaos'
        ) {
          return;
        }
        const resolve = waiting.current.get(msg.id);
        if (!resolve) return;
        waiting.current.delete(msg.id);
        resolve(msg);
      }),
    [],
  );

  const ask = useMemo(
    () =>
      <T extends Reply>(msg: EditorMessage & { id: string }): Promise<T> =>
        new Promise<T>((resolve, reject) => {
          const timer = setTimeout(() => {
            waiting.current.delete(msg.id);
            reject(new Error('A extensão não respondeu'));
          }, REPLY_TIMEOUT_MS);
          waiting.current.set(msg.id, (reply) => {
            clearTimeout(timer);
            resolve(reply as T);
          });
          post(msg);
        }),
    [],
  );

  // Conector ligado: renova a cópia que passou de um dia (ou que não existe).
  const stale =
    needsRefresh(areas?.readAt, Date.now()) || needsRefresh(agencies?.readAt, Date.now());
  useEffect(() => {
    if (!live || !cacheLoaded || !stale) return;
    let alive = true;
    void ask<Extract<Reply, { type: 'listas' }>>({ id: nextId('listas'), type: 'pedir-listas' })
      .then((reply) => {
        if (!alive) return;
        const now = Date.now();
        if (reply.areas?.length) {
          setAreas({ items: reply.areas, readAt: now });
          void saveCachedList('areas', reply.areas, now).catch(() => undefined);
        }
        if (reply.agencies?.length) {
          setAgencies({ items: reply.agencies, readAt: now });
          void saveCachedList('agencias', reply.agencies, now).catch(() => undefined);
        }
        if (reply.error) console.warn('Listas do Lattes:', reply.error);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // Uma vez por ligação, depois de ler a cópia: a resposta atualiza a cópia
    // e tira o "stale".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, ask, cacheLoaded]);

  // As funções de busca leem o estado da ligação por referência: uma
  // identidade só, para a busca em andamento não recomeçar quando a cópia das
  // listas chega ou se renova.
  const liveRef = useRef(live);
  liveRef.current = live;
  const fetchers = useMemo(() => {
    const searchInstitutions = async (query: string, level?: string) => {
      if (!liveRef.current) throw new Error('O conector não está ligado');
      const reply = await ask<Extract<Reply, { type: 'instituicoes' }>>({
        id: nextId('inst'),
        level,
        query,
        type: 'buscar-instituicao',
      });
      if (reply.error) throw new Error(reply.error);
      const results = reply.results ?? [];
      for (const r of results) fullCodes.current.set(withoutLetter(r.code), r.code);
      return results;
    };

    /** O código com a letra da instituição do item: da busca desta sessão, ou de uma busca pelo nome. */
    const fullCodeOf = async (el: XElement, level?: string) => {
      const attrs = institutionAttrs(el);
      const code = getAttr(el, attrs.code) ?? '';
      const known = fullCodes.current.get(code);
      if (known) return known;
      const name = getAttr(el, attrs.name) ?? '';
      const found = (await searchInstitutions(name, level)).find((r) => sameCode(r.code, code));
      if (!found) throw new Error('A instituição do item não apareceu na busca do Lattes');
      return found.code;
    };

    const loadCourses = async (el: XElement, nature = '') => {
      const pairs = livePairs(el.name);
      const course = pairs?.course;
      if (!liveRef.current || !course) throw new Error('O conector não está ligado');
      const byNature = course.byNature?.[foldText(nature)];
      if (course.byNature && !byNature) {
        throw new Error('Escolha a natureza do item antes: a lista de cursos depende dela');
      }
      const { level, staArea } = byNature ?? course;
      const { program } = course;
      const institution = await fullCodeOf(el, pairs.searchLevel);
      const cacheKey = `${institution}|${level}|${program}|${staArea}`;
      let pending = courseCache.current.get(cacheKey);
      if (!pending) {
        pending = ask<Extract<Reply, { type: 'cursos' }>>({
          id: nextId('cursos'),
          institution,
          level,
          // A formação usa a lista FORM; orientação e banca, a TESE.
          ...(program === 'FORM' ? {} : { program, staArea }),
          type: 'pedir-cursos',
        }).then((reply) => {
          if (reply.error || !reply.courses) throw new Error(reply.error ?? 'Sem cursos');
          return reply.courses;
        });
        courseCache.current.set(cacheKey, pending);
        // Falha não fica guardada: o próximo pedido tenta de novo.
        pending.catch(() => courseCache.current.delete(cacheKey));
      }
      return pending;
    };

    const organCache = new Map<string, Promise<Organ[]>>();
    /** Uma página da janela de órgãos, com a letra da instituição e a do órgão de cima. */
    const askOrgans = (institution: string, parent: string, organWindow?: OrganWindowKind) =>
      ask<Extract<Reply, { type: 'orgaos' }>>({
        id: nextId('orgaos'),
        institution,
        ...(organWindow ? { organWindow } : {}),
        ...(parent ? { parent } : {}),
        type: 'pedir-orgaos',
      }).then((reply) => {
        if (reply.error || !reply.organs) throw new Error(reply.error ?? 'Sem órgãos');
        return reply.organs;
      });
    /**
     * O XML guarda os códigos sem a letra. A janela os pede com ela: V para os
     * da tabela do Lattes, D para os cadastrados à parte (inferido). Tenta V,
     * e D quando V volta vazio.
     */
    const loadOrgans = async (institution: string, parent = '', organWindow?: OrganWindowKind) => {
      if (!liveRef.current) throw new Error('O conector não está ligado');
      const cacheKey = `${organWindow ?? 'projeto'}|${institution}|${parent}`;
      let pending = organCache.get(cacheKey);
      if (!pending) {
        pending = (async () => {
          for (const inst of ['V', 'D'].map((l) => l + institution)) {
            for (const up of parent ? ['V', 'D'].map((l) => l + parent) : ['']) {
              const found = await askOrgans(inst, up, organWindow);
              if (found.length > 0) return found;
            }
          }
          return [];
        })();
        organCache.set(cacheKey, pending);
        pending.catch(() => organCache.delete(cacheKey));
      }
      return pending;
    };

    return { loadCourses, loadOrgans, searchInstitutions };
  }, [ask]);

  return useMemo(
    () => ({
      ...fetchers,
      activityOrgans,
      agencies: agencies?.items,
      areas: areas?.items,
      courses: live,
      organs,
      production,
      search: live,
    }),
    [fetchers, live, organs, activityOrgans, production, areas, agencies],
  );
}
