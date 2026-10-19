// Demonstrações locais com dados fictícios. Nada aqui consulta a Crossref nem
// envia ao Lattes. Sem JavaScript a página mostra a primeira tela de cada
// prévia e o primeiro passo do exemplo.
(() => {
  const root = document.getElementById('pagina');

  // Dimensões reais dos arquivos em img/, para o navegador reservar o espaço
  // antes de carregar (ver docs/desenvolvimento.md, "Página do projeto").
  const images = {
    editor: ['img/editor-claro.jpg', 2880, 1720],
    new: ['img/homepage/new.jpg', 2880, 1720],
    panorama: ['img/homepage/panorama.jpg', 2880, 1720],
    'panorama-item': ['img/homepage/panorama-item.jpg', 2880, 1720],
    'panorama-people': ['img/homepage/panorama-people.jpg', 2880, 1720],
    'panorama-timeline': ['img/homepage/panorama-timeline.jpg', 2880, 1720],
  };

  function setImage(image, name, alt) {
    const [src, width, height] = images[name];
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
      alt: 'O editor aberto em Produções: seções à esquerda, itens por tipo e ano no centro, filtros e índice à direita.',
      caption: 'Produções, agrupadas por tipo e ano',
    },
    panorama: {
      alt: 'Panorama: produções por ano em barras, com os anos vazios marcados e as faixas de formação e vínculo embaixo.',
      caption: 'Panorama: produções por ano',
    },
    new: {
      alt: 'O diálogo Novo item de produção, com a busca de tipos e os tipos mais usados.',
      caption: 'Novo item, com busca de tipos',
    },
  };
  const shot = root.querySelector('[data-shot]');
  const shotImage = shot.querySelector('img');
  const shotCaption = shot.querySelector('[data-shot-caption]');
  const shotButtons = [...shot.querySelectorAll('[data-scene]')];

  function drawScene(name) {
    setImage(shotImage, name, scenes[name].alt);
    shotCaption.textContent = scenes[name].caption;
    pressOnly(shotButtons, (button) => button.dataset.scene === name);
  }
  shotButtons.forEach((button) => {
    button.addEventListener('click', () => drawScene(button.dataset.scene));
  });

  // Uma gravação, quando houver, entra no lugar da sequência de telas
  // (docs/desenvolvimento.md). Se não carregar, as telas voltam.
  const video = shot.querySelector('video');
  const shotBar = shot.querySelector('.shot-bar');
  if (video.getAttribute('src')) {
    video.hidden = false;
    shotImage.hidden = true;
    shotBar.hidden = true;
    video.addEventListener('error', () => {
      video.hidden = true;
      shotImage.hidden = false;
      shotBar.hidden = false;
    });
  }

  // ── Panorama: três vistas e a passagem da contagem ao item ──
  const views = {
    production: {
      image: 'panorama',
      title: 'Produções por ano',
      description:
        'Um ano por coluna, uma cor por tipo de produção, e os anos sem nada marcados. O período pode ser um intervalo ou um atalho, como os quadriênios da CAPES.',
      alt: 'Produções por ano no Panorama, com o currículo de demonstração.',
    },
    people: {
      image: 'panorama-people',
      title: 'Pessoas',
      description:
        'Coautores, orientandos, orientadores e bancas, em lista ou em rede. Ao clicar numa pessoa, o painel mostra em que seções ela aparece.',
      alt: 'Pessoas no Panorama: a rede de coautoria, com o currículo de demonstração.',
    },
    timeline: {
      image: 'panorama-timeline',
      title: 'Linha do tempo',
      description:
        'Formação, vínculos, projetos, orientações e prêmios no mesmo eixo de anos. No app, ⌘ ou Ctrl com a roda do mouse aproxima um trecho.',
      alt: 'Linha do tempo no Panorama, com o currículo de demonstração.',
    },
  };
  const item = {
    image: 'panorama-item',
    title: 'O artigo, na seção Produções',
    description:
      'A barra de 2023 abriu a seção Produções filtrada para esse artigo, com o botão Editar ao lado.',
    alt: 'O artigo de 2023 aberto na seção Produções, com o filtro vindo do Panorama.',
  };
  const pan = root.querySelector('[data-pan]');
  const panImage = pan.querySelector('img');
  const panTitle = pan.querySelector('[data-pan-title]');
  const panDescription = pan.querySelector('[data-pan-description]');
  const panButtons = [...pan.querySelectorAll('[data-view]')];
  const drill = pan.querySelector('[data-drill]');
  let view = 'production';
  let showItem = false;

  function drawPanorama() {
    const current = showItem ? item : views[view];
    setImage(panImage, current.image, current.alt);
    panTitle.textContent = current.title;
    panDescription.textContent = current.description;
    pressOnly(panButtons, (button) => button.dataset.view === view);
    drill.hidden = view !== 'production';
    drill.textContent = showItem ? 'Voltar ao gráfico' : 'Abrir o artigo de 2023';
  }
  panButtons.forEach((button) => {
    button.addEventListener('click', () => {
      view = button.dataset.view;
      showItem = false;
      drawPanorama();
    });
  });
  drill.addEventListener('click', () => {
    showItem = !showItem;
    drawPanorama();
  });

  // ── Exemplo de edição: abrir, criar, revisar, enviar ──
  const flow = root.querySelector('[data-flow]');
  const form = flow.querySelector('.flow-form');
  const stepButtons = [...flow.querySelectorAll('[data-step]')];
  const initialTitle = 'Ciência aberta e colaboração no Brasil';
  const types = {
    article: {
      name: 'Artigo',
      route: 'Importar do Lattes',
      title: initialTitle,
      delivery:
        'O app põe o artigo no arquivo que o Importar do Lattes lê. Na versão Dev, a extensão aciona o Importar por você; esse passo ainda está em teste.',
    },
    event: {
      name: 'Evento',
      route: 'Extensão, em teste',
      title: 'Encontro de ciência aberta',
      delivery:
        'Na versão Dev, a extensão grava o evento no Lattes, em teste. Na versão publicada, ele entra na lista do painel com os valores para copiar.',
    },
    project: {
      name: 'Projeto',
      route: 'À mão, no Lattes',
      title: 'Rede de pesquisa em ciência aberta',
      delivery:
        'O projeto fica salvo no app e entra na lista do painel, com cada valor pronto para copiar no formulário do Lattes.',
    },
  };
  const state = { step: 0, type: 'article', title: initialTitle, completed: false };

  function updatePreview() {
    flow.querySelector('[data-live-title]').textContent = state.title || 'Título do novo item';
    flow.querySelector('[data-live-route]').textContent = types[state.type].route;
    flow.querySelector('[data-live-kind]').textContent =
      `${types[state.type].name} de exemplo, 2026. Dados fictícios.`;
  }

  function showStep(step, moveFocus = false) {
    state.step = step;
    const template = document.getElementById(`passo-${step}`);
    form.replaceChildren(template.content.cloneNode(true));
    pressOnly(stepButtons, (button) => Number(button.dataset.step) === step);
    const select = form.querySelector('[data-type]');
    if (select) {
      select.value = state.type;
      form.querySelector('[data-title]').value = state.title;
      form.querySelector('[data-doi]').hidden = state.type !== 'article';
    }
    if (step === 2) {
      form.querySelector('[data-review-title]').textContent = state.title.trim()
        ? 'Título preenchido'
        : 'Título a preencher';
      form.querySelector('[data-review-route]').textContent = `Caminho: ${types[state.type].route}`;
    }
    if (step === 3) {
      form.querySelector('h3').textContent = types[state.type].route;
      form.querySelector('[data-delivery]').textContent = types[state.type].delivery;
      if (state.completed) {
        form.querySelector('.result').textContent =
          'Exemplo concluído. Nada foi enviado ao Lattes.';
      }
    }
    updatePreview();
    if (moveFocus) form.querySelector('h3').focus({ preventScroll: true });
  }

  flow.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-step')) showStep(Number(button.dataset.step));
    if (button.hasAttribute('data-back')) showStep(1, true);
    if (button.hasAttribute('data-next')) {
      if (state.step === 2 && !state.title.trim()) {
        form.querySelector('.result').textContent = 'Preencha o título antes de preparar o envio.';
        return;
      }
      showStep(Math.min(3, state.step + 1), true);
    }
    if (button.hasAttribute('data-doi')) {
      state.title = initialTitle;
      state.completed = false;
      form.querySelector('[data-title]').value = state.title;
      updatePreview();
      form.querySelector('.result').textContent =
        'Dados de exemplo preenchidos, sem consulta à Crossref.';
    }
    if (button.hasAttribute('data-finish')) {
      state.completed = true;
      form.querySelector('.result').textContent = 'Exemplo concluído. Nada foi enviado ao Lattes.';
    }
  });
  form.addEventListener('change', (event) => {
    if (!event.target.matches('[data-type]')) return;
    state.type = event.target.value;
    state.title = types[state.type].title;
    state.completed = false;
    showStep(1);
    form.querySelector('[data-type]').focus();
  });
  form.addEventListener('input', (event) => {
    if (!event.target.matches('[data-title]')) return;
    state.title = event.target.value;
    state.completed = false;
    updatePreview();
  });

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
  showStep(0);
})();
