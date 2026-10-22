import { type CensusResponse, censusTraffic } from './censo-traffic.ts';

// Só a coleta de leitura reaproveita páginas; quadros de edição sempre leem de novo.
const pages = new Map<string, CensusResponse>();
let size = 0;
export function clearCensusCache(): void {
  pages.clear();
  size = 0;
}
export async function censusGet(url: URL): Promise<CensusResponse> {
  censusTraffic.signal.throwIfAborted();
  const key = url.href;
  const cached = pages.get(key);
  if (cached) return cached;
  const response = await censusTraffic.request(url);
  if (size + response.bytes.length <= 32 * 1024 * 1024 && pages.size < 512) {
    pages.set(key, response);
    size += response.bytes.length;
  }
  return response;
}
