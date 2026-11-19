function mountDiagrams(prose: HTMLElement) {
  const diagrams = [
    ...prose.querySelectorAll<HTMLPreElement>('pre[data-language="mermaid"]'),
  ]
    .map((block) => ({
      block,
      source: block.textContent?.trim() ?? '',
      figure: document.createElement('figure'),
    }))
    .filter(({ source }) => source.length > 0);
  if (!diagrams.length) return;

  const diagramText = diagrams.map(({ source }) => source).join('\n');
  let queue = Promise.resolve();
  let renderedAppearance = '';
  let nextId = 0;

  async function renderDiagrams() {
    const darkMode = document.documentElement.dataset.readingTheme === 'dark';
    const styles = getComputedStyle(prose);
    const fontFamily = styles.fontFamily;
    const fontSize = Math.round(parseFloat(styles.fontSize) * 9) / 10;
    const appearance = `${darkMode}/${fontSize}/${fontFamily}`;
    if (appearance === renderedAppearance) return;
    const ink = styles.getPropertyValue('--reading-ink').trim();
    const background = styles.getPropertyValue('--reading-panel').trim();
    if (!ink || !background) return;

    const { default: mermaid } = await import('mermaid');
    await document.fonts
      .load(`${fontSize}px ${fontFamily}`, diagramText)
      .catch(() => {});

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      htmlLabels: false,
      theme: 'base',
      look: 'classic',
      fontFamily,
      fontSize,
      flowchart: { nodeSpacing: 24, rankSpacing: 28, padding: 9 },
      sequence: {
        width: 120,
        height: 40,
        actorMargin: 28,
        diagramMarginX: 10,
      },
      themeVariables: {
        darkMode,
        fontFamily,
        fontSize: `${fontSize}px`,
        background,
        edgeLabelBackground: background,
        primaryColor: darkMode ? '#33334b' : '#ececf8',
        primaryBorderColor: darkMode ? '#9292bc' : '#777794',
        secondaryColor: darkMode ? '#2f4146' : '#e6efee',
        tertiaryColor: darkMode ? '#3a3a44' : '#f3f0e7',
        lineColor: darkMode ? '#b6b6d0' : '#666680',
        textColor: ink,
        primaryTextColor: ink,
        secondaryTextColor: ink,
        tertiaryTextColor: ink,
      },
    });

    for (const { block, source, figure } of diagrams) {
      try {
        const { svg } = await mermaid.render(
          `desk-mermaid-${++nextId}`,
          source,
        );
        const scrollLeft = figure.scrollLeft;
        figure.innerHTML = svg;

        const graphic = figure.querySelector('svg');
        const width = graphic?.viewBox.baseVal.width;
        if (graphic && width)
          graphic.style.inlineSize = `${Math.ceil(width)}px`;

        figure.className = 'mermaid-diagram';
        figure.tabIndex = 0;
        figure.setAttribute(
          'aria-label',
          graphic?.querySelector('title')?.textContent || 'Diagram',
        );
        if (block.isConnected) block.replaceWith(figure);
        figure.scrollLeft = scrollLeft;
      } catch (error) {
        if (figure.isConnected) figure.replaceWith(block);
        console.warn('Unable to render a Mermaid diagram.', error);
      }
    }

    renderedAppearance = appearance;
  }

  function scheduleRender() {
    queue = queue.then(renderDiagrams).catch((error) => {
      console.warn('Unable to load Mermaid diagrams.', error);
    });
  }

  document.addEventListener('reading-preferences-change', scheduleRender);
  // The first render can run before the reading styles have loaded in WebKit.
  if (document.readyState !== 'complete') {
    window.addEventListener('load', scheduleRender, { once: true });
  }
  scheduleRender();
}

const prose = document.querySelector<HTMLElement>('.article-prose');
if (prose) mountDiagrams(prose);
