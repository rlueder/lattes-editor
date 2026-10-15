// Demonstrações locais com dados fictícios. Nenhuma ação consulta ou envia dados ao Lattes.
(() => {
  const root = document.getElementById('homepage');
  const form = root.querySelector('.cp-form');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const initialTitle = 'Ciência aberta e colaboração no Brasil';
  const types = {
    article: { name: 'Artigo', route: 'Importar', title: initialTitle },
    event: { name: 'Evento', route: 'Conector · em teste', title: 'Encontro de ciência aberta' },
    project: {
      name: 'Projeto',
      route: 'Preenchimento manual',
      title: 'Rede de pesquisa em ciência aberta',
    },
  };
  const state = { step: 0, type: 'article', title: initialTitle, completed: false };

  function updatePreview() {
    root.querySelector('[data-live-title]').textContent = state.title || 'Título do novo item';
    root.querySelector('[data-live-route]').textContent = types[state.type].route;
    root.querySelector('.cp-leaf p').textContent =
      `${types[state.type].name} de exemplo · 2026. Dados fictícios.`;
  }

  function showStep(step, moveFocus = false) {
    state.step = step;
    const template = document.getElementById(`workflow-step-${step}`);
    form.replaceChildren(template.content.cloneNode(true));
    root.querySelectorAll('[data-step]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.step) === step));
    });
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
      form.querySelector('[data-review-route]').textContent = `Envio: ${types[state.type].route}`;
    }
    if (step === 3) prepareDelivery();
    updatePreview();
    if (moveFocus) form.querySelector('h3').focus({ preventScroll: true });
  }

  function prepareDelivery() {
    const descriptions = {
      article:
        'O app inclui o artigo no arquivo de produções novas para o Importar do Lattes. A execução automática desse processo pela extensão ainda está em teste.',
      event:
        'A inclusão de eventos depende de uma versão da extensão que aceite essa operação. O recurso está em teste no Lattes.',
      project:
        'O projeto fica salvo no editor, mas precisa ser cadastrado manualmente no Lattes. O painel apresenta os dados para copiar.',
    };
    form.querySelector('h3').textContent = types[state.type].route;
    form.querySelector('[data-delivery-description]').textContent = descriptions[state.type];
    if (state.completed)
      form.querySelector('.cp-result').textContent = 'Demonstração concluída, sem envio ao Lattes.';
  }

  function handleWorkflowClick(button) {
    if (button.hasAttribute('data-step')) showStep(Number(button.dataset.step));
    if (button.hasAttribute('data-back')) showStep(1, true);
    if (button.hasAttribute('data-next')) {
      if (state.step === 2 && !state.title.trim()) {
        form.querySelector('.cp-result').textContent =
          'Preencha o título antes de preparar o envio.';
        return;
      }
      showStep(Math.min(3, state.step + 1), true);
    }
    if (button.hasAttribute('data-doi')) {
      state.title = initialTitle;
      state.completed = false;
      form.querySelector('[data-title]').value = state.title;
      updatePreview();
      form.querySelector('.cp-result').textContent =
        'Dados de exemplo preenchidos, sem consulta à Crossref.';
    }
    if (button.hasAttribute('data-finish')) {
      state.completed = true;
      form.querySelector('.cp-result').textContent = 'Demonstração concluída, sem envio ao Lattes.';
    }
  }

  root.querySelector('.cp-flow').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) handleWorkflowClick(button);
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

  const imageSizes = {
    panorama: [1280, 720],
    'panorama-item': [1280, 720],
    'panorama-people': [1265, 712],
    'panorama-timeline': [1280, 720],
    new: [2880, 1720],
  };

  function setImage(image, name, alt) {
    const [width, height] = imageSizes[name];
    image.width = width;
    image.height = height;
    image.src = `img/homepage/${name}.jpg`;
    image.alt = alt;
  }

  const views = {
    production: {
      image: 'panorama',
      title: 'Produções por ano',
      description:
        'Compare os tipos de produção ao longo dos anos. Os filtros permitem escolher um intervalo ou usar um período predefinido.',
    },
    people: {
      image: 'panorama-people',
      title: 'Pessoas',
      description:
        'Consulte coautores, orientadores, orientandos e participantes de bancas e projetos. A vista em rede mostra as relações de coautoria.',
    },
    timeline: {
      image: 'panorama-timeline',
      title: 'Linha do tempo',
      description:
        'Veja quando ocorreram a formação, os vínculos, os projetos, as orientações e os prêmios. No app, o zoom permite examinar um trecho da carreira.',
    },
  };
  let selectedView = 'production';
  let showItem = false;
  const drillButton = root.querySelector('[data-pan-drill]');

  function drawPanorama() {
    const view = views[selectedView];
    const image = root.querySelector('[data-pan-image]');
    setImage(
      image,
      showItem ? 'panorama-item' : view.image,
      showItem
        ? 'Artigo de 2023 aberto no currículo a partir do Panorama'
        : `${view.title} no Panorama, com currículo fictício`,
    );
    root.querySelector('[data-pan-title]').textContent = showItem
      ? 'Artigo selecionado no currículo'
      : view.title;
    root.querySelector('[data-pan-description]').textContent = showItem
      ? 'Ao selecionar o artigo de 2023 no gráfico, o app abre a seção Produções filtrada para esse item. A edição fica disponível na mesma tela.'
      : view.description;
    root.querySelectorAll('[data-pan]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.pan === selectedView));
    });
    drillButton.hidden = selectedView !== 'production';
    drillButton.textContent = showItem ? '← Voltar ao gráfico' : 'Ver artigo de 2023 →';
  }

  root.querySelector('.cp-pan-tabs').addEventListener('click', (event) => {
    const button = event.target.closest('[data-pan]');
    if (!button) return;
    selectedView = button.dataset.pan;
    showItem = false;
    drawPanorama();
  });
  drillButton.addEventListener('click', () => {
    showItem = !showItem;
    drawPanorama();
  });

  const scenes = [
    {
      image: 'panorama',
      title: '01 / Panorama: produções por ano',
      alt: 'Produções por ano no Panorama em desenvolvimento',
    },
    {
      image: 'panorama-item',
      title: '02 / Artigo selecionado no currículo',
      alt: 'Artigo de 2023 aberto a partir do Panorama',
    },
    { image: 'new', title: '03 / Novo item de produção', alt: 'Diálogo Novo item de produção' },
  ];
  let sceneIndex = 0;
  let timer = null;
  const playButton = root.querySelector('.cp-play');

  function drawScene() {
    const scene = scenes[sceneIndex];
    const image = root.querySelector('.cp-screen img');
    setImage(image, scene.image, scene.alt);
    root.querySelector('.cp-scene-title').textContent = scene.title;
    root.querySelectorAll('[data-scene]').forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.scene) === sceneIndex));
    });
  }

  function stopPlayback() {
    window.clearInterval(timer);
    timer = null;
    playButton.textContent = reducedMotion.matches ? 'Próxima tela →' : '▶ Reproduzir prévia';
    playButton.setAttribute('aria-pressed', 'false');
  }

  playButton.addEventListener('click', () => {
    if (reducedMotion.matches) {
      sceneIndex = (sceneIndex + 1) % scenes.length;
      drawScene();
    } else if (timer) {
      stopPlayback();
    } else {
      sceneIndex = 0;
      drawScene();
      playButton.textContent = 'Ⅱ Pausar prévia';
      playButton.setAttribute('aria-pressed', 'true');
      timer = window.setInterval(() => {
        sceneIndex += 1;
        drawScene();
        if (sceneIndex === scenes.length - 1) stopPlayback();
      }, 2800);
    }
  });
  root.querySelector('.cp-scenes').addEventListener('click', (event) => {
    const button = event.target.closest('[data-scene]');
    if (!button) return;
    stopPlayback();
    sceneIndex = Number(button.dataset.scene);
    drawScene();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPlayback();
  });
  reducedMotion.addEventListener('change', stopPlayback);

  root.querySelectorAll('[data-enhanced]').forEach((element) => {
    element.hidden = false;
  });
  showStep(0);
  stopPlayback();
  const video = root.querySelector('[data-workflow-video]');
  // Ao adicionar uma gravação, configure src no vídeo e mantenha a prévia como alternativa.
  if (video.getAttribute('src')) {
    video.hidden = false;
    root.querySelector('.cp-screen img').hidden = true;
    root.querySelector('.cp-filmbar').hidden = true;
    root.querySelector('.cp-filmnote').textContent =
      'Fluxo no app com currículo fictício. Panorama em desenvolvimento.';
    video.addEventListener('error', () => {
      video.hidden = true;
      root.querySelector('.cp-screen img').hidden = false;
      root.querySelector('.cp-filmbar').hidden = false;
      root.querySelector('.cp-filmnote').textContent =
        'O vídeo não carregou. Veja a sequência de telas do app na prévia.';
    });
  }
})();
