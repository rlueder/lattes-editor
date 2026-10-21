// Demonstrações locais com dados fictícios. Nada aqui consulta a Crossref nem
// envia ao Lattes. Sem JavaScript a página mostra a primeira tela de cada
// prévia.
(() => {
  const root = document.getElementById('pagina');

  // Dimensões reais dos arquivos em img/homepage/, para o navegador reservar
  // o espaço antes de carregar (ver docs/desenvolvimento.md, "Página do
  // projeto"). Todas vêm da mesma janela de 1440 × 860 em 2x, e as da
  // abertura e do Panorama têm uma animação (WebP) para quem aceita movimento.
  const images = {
    'hero-editor': ['img/homepage/hero-editor.jpg', 2880, 1720, 'img/homepage/hero-editor.webp'],
    'hero-new': ['img/homepage/hero-new.jpg', 2880, 1720, 'img/homepage/hero-new.webp'],
    'hero-panorama': [
      'img/homepage/hero-panorama.jpg',
      2880,
      1720,
      'img/homepage/hero-panorama.webp',
    ],
    panorama: ['img/homepage/panorama.jpg', 2880, 1720, 'img/homepage/panorama.webp'],
    'panorama-health': [
      'img/homepage/panorama-health.jpg',
      2880,
      1720,
      'img/homepage/panorama-health.webp',
    ],
    'panorama-people': [
      'img/homepage/panorama-people.jpg',
      2880,
      1720,
      'img/homepage/panorama-people.webp',
    ],
    'panorama-timeline': [
      'img/homepage/panorama-timeline.jpg',
      2880,
      1720,
      'img/homepage/panorama-timeline.webp',
    ],
  };

  // Troca a captura e, quando a imagem está num `picture`, a animação.
  function setImage(image, name, alt) {
    const [src, width, height, animated] = images[name];
    const source = image.parentElement.querySelector('source');
    if (source) source.srcset = animated ?? '';
    image.width = width;
    image.height = height;
    image.src = src;
    image.alt = alt;
  }

  function pressOnly(buttons, isPressed) {
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(isPressed(button)));
    });
  }

  // ── Abertura: três telas do app ──
  const scenes = {
    editor: {
      image: 'hero-editor',
      alt: 'O editor em Produções: a barra lateral leva ao grupo Artigos completos publicados e a barra de anos, a 2022.',
      caption: 'Produções, agrupadas por tipo e ano',
    },
    panorama: {
      image: 'hero-panorama',
      alt: 'O controle Currículo | Panorama abre Produções por ano; um clique na barra de 2023 abre a seção filtrada.',
      caption: 'Panorama: produções por ano',
    },
    new: {
      image: 'hero-new',
      alt: 'O diálogo Novo item de produção: o filtro de tipos acha Artigo completo publicado e abre o formulário.',
      caption: 'Novo item, com busca de tipos',
    },
  };
  const shot = root.querySelector('[data-shot]');
  const shotImage = shot.querySelector('img');
  const shotCaption = shot.querySelector('[data-shot-caption]');
  const shotButtons = [...shot.querySelectorAll('[data-scene]')];

  function drawScene(name) {
    setImage(shotImage, scenes[name].image, scenes[name].alt);
    shotCaption.textContent = scenes[name].caption;
    pressOnly(shotButtons, (button) => button.dataset.scene === name);
  }
  shotButtons.forEach((button) => {
    button.addEventListener('click', () => drawScene(button.dataset.scene));
  });

  // Clicar numa tela (figuras com data-zoom) abre a mesma imagem em tamanho
  // maior. Sem `dialog` (navegadores antigos), o botão nem aparece.
  const lightbox = document.querySelector('[data-lightbox]');
  const shotOpen = shot.querySelector('.shot-open');
  if (lightbox && typeof lightbox.showModal === 'function') {
    const lightboxImage = lightbox.querySelector('img');
    root.querySelectorAll('[data-zoom]').forEach((figure) => {
      const button = figure.querySelector('.shot-open');
      const image = figure.querySelector('img');
      button.hidden = false;
      button.addEventListener('click', () => {
        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        lightbox.showModal();
      });
    });
    lightbox.querySelector('[data-lightbox-close]').addEventListener('click', () => {
      lightbox.close();
    });
    // Clique fora da imagem (no fundo escuro) ou na própria imagem fecha.
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox || event.target === lightboxImage) lightbox.close();
    });
    lightbox.addEventListener('close', () => {
      lightboxImage.removeAttribute('src');
    });
  }

  // Uma gravação, quando houver, entra no lugar da sequência de telas
  // (docs/desenvolvimento.md). Se não carregar, as telas voltam.
  const video = shot.querySelector('video');
  const shotBar = shot.querySelector('.shot-bar');
  const shotSwitch = shot.querySelector('.shot-switch');
  if (video.getAttribute('src')) {
    video.hidden = false;
    shotImage.hidden = true;
    shotOpen.hidden = true;
    shotBar.hidden = true;
    shotSwitch.hidden = true;
    video.addEventListener('error', () => {
      video.hidden = true;
      shotImage.hidden = false;
      shotOpen.hidden = !lightbox;
      shotBar.hidden = false;
      shotSwitch.hidden = false;
    });
  }

  // ── Panorama: três vistas, cada uma com a sua animação ──
  const views = {
    production: {
      image: 'panorama',
      title: 'Produções por ano',
      description:
        'Uma coluna por ano, com uma cor para cada tipo de produção. Os anos sem nada vêm marcados, e um clique numa barra abre a seção com aqueles itens.',
      alt: 'Produções por ano no Panorama: um clique na barra de 2023 abre a seção Produções filtrada para o artigo daquele ano.',
    },
    health: {
      image: 'panorama-health',
      title: 'Saúde do currículo',
      description:
        'O que falta preencher: itens sem DOI, sem ISSN, sem palavras-chave, sem agência de fomento. Um clique numa contagem abre a seção com o filtro "Faltando" aplicado.',
      alt: 'Saúde do currículo no Panorama: as contagens do que falta, e um clique numa delas abre a seção filtrada.',
    },
    people: {
      image: 'panorama-people',
      title: 'Pessoas',
      description:
        'Coautores, orientandos, orientadores e bancas, em lista ou em rede. Ao clicar numa pessoa, o painel mostra em que seções ela aparece.',
      alt: 'Pessoas no Panorama: a lista vira rede de coautoria, e um clique numa pessoa abre o painel com as seções em que ela aparece.',
    },
    timeline: {
      image: 'panorama-timeline',
      title: 'Linha do tempo',
      description:
        'Formação, vínculos, projetos, orientações e prêmios no mesmo eixo de anos. ⌘ ou Ctrl com a roda do mouse aproxima um trecho.',
      alt: 'Linha do tempo no Panorama: o zoom com a roda do mouse aproxima os anos recentes.',
    },
  };
  const pan = root.querySelector('[data-pan]');
  const panImage = pan.querySelector('img');
  const panTitle = pan.querySelector('[data-pan-title]');
  const panDescription = pan.querySelector('[data-pan-description]');
  const panButtons = [...pan.querySelectorAll('[data-view]')];
  let view = 'production';

  function drawPanorama() {
    const current = views[view];
    setImage(panImage, current.image, current.alt);
    panTitle.textContent = current.title;
    panDescription.textContent = current.description;
    pressOnly(panButtons, (button) => button.dataset.view === view);
  }
  panButtons.forEach((button) => {
    button.addEventListener('click', () => {
      view = button.dataset.view;
      drawPanorama();
    });
  });

  // ── O botão principal leva ao instalador do sistema de quem lê ──
  // Sem sistema reconhecido (celular, outro), fica o link para a seção Baixar,
  // que lista todos. No Linux vai o .deb; o AppImage continua na seção.
  const RELEASE = 'https://github.com/rlueder/lattes-editor/releases/latest/download/';
  const installers = {
    linux: { file: 'LattesEditor-Linux.deb', icon: 'icone-linux', label: 'Baixar para Linux' },
    macos: { file: 'LattesEditor-macOS.dmg', icon: 'icone-macos', label: 'Baixar para macOS' },
    windows: {
      file: 'LattesEditor-Windows-setup.exe',
      icon: 'icone-windows',
      label: 'Baixar para Windows',
    },
  };
  function detectOs() {
    const platform = navigator.userAgentData?.platform ?? navigator.platform ?? '';
    const agent = navigator.userAgent;
    if (/Android|iPhone|iPad|iPod/i.test(agent)) return null;
    if (/^Mac/i.test(platform)) return 'macos';
    if (/^Win/i.test(platform)) return 'windows';
    if (/Linux|X11/i.test(platform) || /Linux/i.test(agent)) return 'linux';
    return null;
  }
  const download = root.querySelector('[data-download]');
  const os = detectOs();
  if (download && os) {
    download.href = RELEASE + installers[os].file;
    download.querySelector('[data-download-label]').textContent = installers[os].label;
    download.querySelector('[data-download-icon]').setAttribute('href', `#${installers[os].icon}`);
    // `hidden` como propriedade não existe em SVGElement; vai pelo atributo.
    download.querySelector('svg').removeAttribute('hidden');
  }

  // Fecha o menu do cabeçalho ao escolher um destino.
  const menu = root.querySelector('.menu');
  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => menu.removeAttribute('open'));
  });

  root.querySelectorAll('[data-enhanced]').forEach((element) => {
    element.hidden = false;
  });
  drawScene('editor');
  drawPanorama();
})();
