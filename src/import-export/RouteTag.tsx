// Selo de como uma coisa vai ao Lattes (send-routes.ts): conector, Importar ou à mão.

import { ROUTE_LABEL, type SendRoute } from './send-routes.ts';

export function RouteTag({ route }: { route: SendRoute }) {
  return <span className={`route-tag route-${route}`}>{ROUTE_LABEL[route]}</span>;
}
