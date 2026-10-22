// Recursos passam pelo transporte antes de entrar no quadro sem rede.
import { decodeLatin1 } from '../../src/model/latin1.ts';
import { FRAME_POLICY, localFrameReferences } from './censo-frame-protocol.ts';
import { censusGet } from './censo-reading.ts';

export async function htmlFor(html: string, url: string): Promise<string> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc
    .querySelectorAll(
      'base, meta[http-equiv], iframe, frame, object, embed, img, source, video, audio',
    )
    .forEach((el) => el.remove());
  for (const script of doc.querySelectorAll<HTMLScriptElement>('script[src]')) {
    const response = await censusGet(new URL(script.getAttribute('src')!, url));
    script.removeAttribute('src');
    script.textContent = decodeLatin1(response.bytes);
  }
  for (const link of doc.querySelectorAll<HTMLLinkElement>('link')) {
    if (link.rel === 'stylesheet' && link.getAttribute('href')) {
      const response = await censusGet(new URL(link.getAttribute('href')!, url));
      const style = doc.createElement('style');
      style.textContent = decodeLatin1(response.bytes);
      link.replaceWith(style);
    } else link.remove();
  }
  for (const script of doc.querySelectorAll('script')) {
    script.textContent = localFrameReferences(script.textContent ?? '').replace(
      /<\/script/gi,
      '<\\/script',
    );
  }
  for (const el of doc.querySelectorAll('*')) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || /^javascript:/i.test(attr.value))
        el.setAttribute(attr.name, localFrameReferences(attr.value));
    }
  }
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = FRAME_POLICY;
  doc.head.prepend(policy);
  return `<!doctype html>${doc.documentElement.outerHTML}`;
}
