const DEFAULT_THEME = {
  bgMain: '#181820',
  bgCode: '#1e1e28',
  textMain: '#dcddde',
  textHeader: '#a899e6',
  textAbility: '#6fa8dc',
  borderLine: '#324a5e',
  codeCyan: '#56b6c2',
  kwBlood: '#e06c75',
  kwBleed: '#e05252',
  kwHeal: '#98c379',
  kwBuff: '#61afef',
  kwDebuff: '#c678dd',
  kwNumber: '#d19a66',
  kwCrystal: '#61afef',
  kwDuration: '#61afef'
};

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlightInline(text) {
  let out = escapeHtml(text);

  // Convert inline [AbilityName] references to clean blue text without brackets
  out = out.replace(/\[([^\]]+)\]/g, '<span class="ability-ref" data-role="textAbility">$1</span>');

  // Highlight durations like "for 1 turn", "for 3 turns"
  out = out.replace(/\b(for\s+\d+\s+turns?)\b/gi, '<span class="kw-dur" data-role="kwDuration">$1</span>');

  // Highlight numbers, percentages, and math formulas like 15% + (5% * shard) or 1/100
  out = out.replace(/(\b\d+(?:\/\d+|%)?(?:\s*[\+\-\*\/]\s*\([^)]+\))?)/g, '<span class="kw-num" data-role="kwNumber">$1</span>');

  // Highlight keywords
  out = out.replace(/\b(blood|burn|rot|dark)\b/gi, '<span class="kw-blood" data-role="kwBlood">$1</span>');
  out = out.replace(/\b(bleed|bleeding|dies|execute|lose)\b/gi, '<span class="kw-bleed" data-role="kwBleed">$1</span>');
  out = out.replace(/\b(heal|healing|heals)\b/gi, '<span class="kw-heal" data-role="kwHeal">$1</span>');
  out = out.replace(/\b(crystalized|stun|stunned|lightning|steal a buff)\b/gi, '<span class="kw-crystal" data-role="kwCrystal">$1</span>');
  out = out.replace(/\b(reverse a debuff|anti heal)\b/gi, '<span class="kw-debuff" data-role="kwDebuff">$1</span>');

  return out;
}

function parseTrelloMarkdown(rawText, theme = DEFAULT_THEME) {
  const lines = (rawText || '').split('\n');
  const htmlParts = [];
  let inCodeBlock = false;
  let codeLines = [];
  let inItemBody = false;

  const closeItemBody = () => {
    if (inItemBody) {
      htmlParts.push('</div></div>');
      inItemBody = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Handle ``` or - ``` code blocks (like Stats)
    if (/^(?:[-*•]\s*)?```/.test(trimmed)) {
      if (!inCodeBlock) {
        closeItemBody();
        inCodeBlock = true;
        codeLines = [];
      } else {
        inCodeBlock = false;
        const formattedCode = codeLines.map(cl => {
          const eqMatch = cl.match(/^([^=]+)=(.+)\$/);
          if (eqMatch) {
            return `<div><span class="code-key" data-role="codeCyan">${escapeHtml(eqMatch[1].trim())}</span> <span class="code-eq">=</span> <span class="code-val" data-role="codeCyan">${escapeHtml(eqMatch[2].trim())}</span></div>`;
          }
          return `<div>${escapeHtml(cl)}</div>`;
        }).join('');
        htmlParts.push(`<div class="stats-block" data-role="bgCode">${formattedCode}</div>`);
      }
      continue;
    }

    if (inCodeBlock) {
      if (trimmed !== '') codeLines.push(trimmed);
      continue;
    }

    // Handle Section Headers: "Stats", "## [Abilities]", "[Passives]", "## Resistances", etc.
    const markdownHeader = trimmed.match(/^#{1,3}\s*\[?([^\]]+)\]?\$/);
    const plainSection = trimmed.match(/^\[?(Stats\vert{}Abilities\vert{}Passives\vert{}Resistances\vert{}Weaknesses)\]?\$/i);
    if ((markdownHeader || plainSection) && !trimmed.includes('(')) {
      closeItemBody();
      const titleText = (markdownHeader ? markdownHeader[1] : plainSection[1]).trim();
      const tag = titleText.toLowerCase() === 'stats' ? 'h3' : 'h2';
      htmlParts.push(`<${tag} class="section-header" data-role="textHeader">${escapeHtml(titleText)}</${tag}>`);
      continue;
    }

    // Handle Ability / Passive Item Headers: "[Bloodbloom](0 Energy)(0 CD)" or "- [Solemn flame]"
    const itemHeaderMatch = trimmed.match(/^(?:[-*•]\s*)?\[([^\]]+)\]((?:\s*\([^)]+\))*)\$/);
    if (itemHeaderMatch) {
      closeItemBody();
      const itemName = itemHeaderMatch[1].trim();
      const metaTags = itemHeaderMatch[2].trim();
      htmlParts.push(`
        <div class="tree-item">
          <div class="item-header">
            <span class="bullet">•</span>
            <span class="item-title" data-role="textAbility">${escapeHtml(itemName)}</span>
            ${metaTags ? `<span class="item-meta" data-role="textHeader">\${escapeHtml(metaTags)}</span>` : ''}
          </div>
          <div class="indented-body" data-role="borderLine">
      `);
      inItemBody = true;
      continue;
    }

    // Empty line inside an item body separates paragraphs cleanly
    if (trimmed === '') {
      if (inItemBody) {
        htmlParts.push('<div class="para-spacer"></div>');
      }
      continue;
    }

    // Bullet points: "- If an enemy..."
    const bulletMatch = trimmed.match(/^[-*•]\s+(.*)\$/);
    if (bulletMatch) {
      const content = highlightInline(bulletMatch[1]);
      htmlParts.push(`<div class="sub-bullet"><span class="sub-dot">•</span><span>${content}</span></div>`);
      continue;
    }

    // Standalone "Key = Value" lines outside of ``` blocks
    const standaloneStat = trimmed.match(/^([A-Za-z0-9_]+)\s*=\s*(.+)$/);
    if (standaloneStat && !inItemBody) {
      htmlParts.push(`
        <div class="stats-inline" data-role="bgCode">
          <span class="code-key" data-role="codeCyan">${escapeHtml(standaloneStat[1])}</span>
          <span class="code-eq">=</span>
          <span class="code-val" data-role="codeCyan">${escapeHtml(standaloneStat[2])}</span>
        </div>
      `);
      continue;
    }

    // Regular description paragraph
    const styledLine = highlightInline(trimmed);
    htmlParts.push(`<p class="body-para">${styledLine}</p>`);
  }

  closeItemBody();

  return `
    <style>
      body {
        background-color: ${theme.bgMain};
        color: ${theme.textMain};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14.5px;
        line-height: 1.6;
        padding: 18px 22px;
        margin: 0;
      }
      h2.section-header {
        color: ${theme.textHeader};
        font-size: 1.55em;
        font-weight: 700;
        margin: 26px 0 14px 0;
        padding-bottom: 6px;
        border-bottom: 1px solid #2b2b36;
      }
      h3.section-header {
        color: ${theme.textHeader};
        font-size: 1.1em;
        font-weight: 600;
        margin: 0 0 10px 0;
      }
      .stats-block {
        background-color: ${theme.bgCode};
        border: 1px solid #262633;
        border-radius: 6px;
        padding: 12px 16px;
        font-family: "Fira Code", "JetBrains Mono", Consolas, monospace;
        font-size: 0.92em;
        line-height: 1.65;
        margin-bottom: 22px;
      }
      .stats-inline {
        background-color: ${theme.bgCode};
        padding: 3px 12px;
        font-family: "Fira Code", "JetBrains Mono", Consolas, monospace;
        font-size: 0.92em;
      }
      .code-key, .code-val { color: ${theme.codeCyan || '#56b6c2'}; }
      .code-eq { color: #abb2bf; }

      .tree-item {
        margin-bottom: 20px;
      }
      .item-header {
        display: flex;
        align-items: baseline;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 6px;
      }
      .bullet {
        color: #6c7a89;
        font-size: 0.95em;
        margin-right: 2px;
      }
      .item-title {
        color: ${theme.textAbility};
        font-weight: 600;
      }
      .item-meta {
        color: ${theme.textHeader};
        font-style: italic;
      }
      .indented-body {
        margin-left: 4px;
        padding-left: 16px;
        border-left: 1.5px solid ${theme.borderLine};
      }
      .body-para {
        margin: 0 0 6px 0;
      }
      .para-spacer {
        height: 8px;
      }
      .sub-bullet {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 7px;
      }
      .sub-dot {
        color: #828997;
        line-height: 1.5;
      }
      .ability-ref { color: ${theme.textAbility}; }
      .kw-num { color: ${theme.kwNumber}; font-style: italic; }
      .kw-blood { color: ${theme.kwBlood}; }
      .kw-bleed { color: ${theme.kwBleed || theme.kwBlood}; }
      .kw-heal { color: ${theme.kwHeal}; }
      .kw-crystal { color: ${theme.kwCrystal}; }
      .kw-debuff { color: ${theme.kwDebuff || theme.textHeader}; }
      .kw-dur { color: ${theme.kwDuration || theme.kwCrystal}; font-style: italic; }
    </style>
    <div id="rendered-content" data-role="bgMain">${htmlParts.join('\n')}</div>
  `;
}
