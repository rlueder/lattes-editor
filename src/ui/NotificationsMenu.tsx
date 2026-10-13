// Sino do cabeçalho, ao lado das configurações e no mesmo tipo de menu: o
// que impede o app de ler o Lattes ou de guardar o trabalho
// (notifications.ts). O ponto no sino só acende com o que pede ação.

import { Menu } from '@base-ui/react/menu';

import { installUpdate } from '../desktop/update.ts';
import { BellIcon } from './icons.tsx';
import type { Notice } from './notifications.ts';
import { Tip } from './primitives/Tip.tsx';
import { openStorageNotice } from './storage-notice-open.ts';

export function NotificationsMenu({ notices }: { notices: Notice[] }) {
  const urgent = notices.some((n) => n.level === 'aviso');
  const label = notices.length ? `Notificações (${notices.length})` : 'Notificações';
  return (
    <Menu.Root>
      <Tip label={label}>
        <Menu.Trigger aria-label={label} className="ghost icon-btn">
          <BellIcon />
          {urgent && <span aria-hidden="true" className="dot badge-dot warn" />}
        </Menu.Trigger>
      </Tip>
      <Menu.Portal>
        <Menu.Positioner align="end" className="popup-positioner" sideOffset={6}>
          <Menu.Popup className="menu notices">
            <Menu.Group>
              <Menu.GroupLabel className="menu-heading">Notificações</Menu.GroupLabel>
              {notices.length === 0 && <p className="notice-empty">Nenhuma notificação.</p>}
              {notices.map((n) =>
                n.action ? (
                  <Menu.Item
                    key={n.id}
                    className={`menu-item notice ${n.level}`}
                    onClick={
                      n.action === 'armazenamento' ? openStorageNotice : () => void installUpdate()
                    }
                  >
                    <NoticeBody notice={n} />
                  </Menu.Item>
                ) : n.link ? (
                  // O link é o que fazer: um item do menu, alcançável pelo teclado.
                  <Menu.LinkItem
                    key={n.id}
                    className={`menu-item notice ${n.level}`}
                    href={n.link.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <NoticeBody notice={n} />
                  </Menu.LinkItem>
                ) : (
                  <div key={n.id} className={`notice ${n.level}`}>
                    <NoticeBody notice={n} />
                  </div>
                ),
              )}
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function NoticeBody({ notice }: { notice: Notice }) {
  return (
    <span className="notice-body">
      <span className="notice-title">{notice.title}</span>
      <span className="notice-text">
        {notice.text}
        {notice.link && (
          <>
            {' '}
            <span className="notice-link">{notice.link.label}</span>
          </>
        )}
      </span>
    </span>
  );
}
