const DEFAULT_THEME = {
  bgMain: '#181820',
  bgCode: '#1e1e28',
  textMain: '#dcddde',
  textHeader: '#a899e6',
  textAbility: '#6fa8dc',
  borderLine: '#324a5e',
  codeCyan: '#56b6c2',
  textNumber: '#d19a66',
  textDuration: '#98c379',
  textMetadata: '#c678dd',
  textReference: '#6fa8dc',
  textStatKey: '#56b6c2',
  textStatValue: '#dcddde',
  textEmphasis: '#e5c07b',
  textBullet: '#828997'
};

function normalizeTheme(savedTheme) {
  const normalized = { ...DEFAULT_THEME };
  if (!savedTheme || typeof savedTheme !== 'object') return normalized;
  for (const key of Object.keys(DEFAULT_THEME)) {
    const value = savedTheme[key];
    if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      normalized[key] = value;
    }
  }
  // Migrate older saved themes without retaining character-specific roles.
  const legacy = {
    textNumber: 'kwNumber',
    textDuration: 'kwDuration',
    textMetadata: 'textHeader',
    textReference: 'textAbility',
    textStatKey: 'codeCyan',
    textStatValue: 'codeCyan'
  };
  for (const [nextKey, oldKey] of Object.entries(legacy)) {
    const value = savedTheme[oldKey];
    if (normalized[nextKey] === DEFAULT_THEME[nextKey] &&
        typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) {
      normalized[nextKey] = value;
    }
  }
  return normalized;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function highlightInline(value) {
  let html = escapeHtml(value);

  // Inline code and emphasis are parsed before semantic syntax highlighting.
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

  // Parenthetical metadata is intentionally syntax-based, not word-based.
  html = html.replace(/(\([^()\n]{1,80}\))/g,
    '<span class="item-meta" data-role="textMetadata">$1</span>');

  // Square-bracket references are treated uniformly, regardless of their names.
  html = html.replace(/\[([^\]\n]+)\]/g,
    '<span class="ability-ref" data-role="textReference">$1</span>');

  // Durations and numbers are identified by their shape, not their meaning.
  html = html.replace(/\b(for\s+\d+(?:\.\d+)?\s+(?:turns?|rounds?|seconds?|minutes?|hours?))\b/gi,
    '<span class="kw-dur" data-role="textDuration">$1</span>');
  html = html.replace(/(?<![\w-])[-+]?\d+(?:\.\d+)?(?:%|\b)(?:\s*\/\s*\d+(?:\.\d+)?)?/g,
    '<span class="kw-num" data-role="textNumber">$&</span>');

  return html;
}

function parseTrelloMarkdown(rawText, savedTheme = DEFAULT_THEME) {
  const theme = normalizeTheme(savedTheme);
  const lines = String(rawText || '').replace(/\r\n?/g, '\n').split('\n');
  const output = [];
  let inCode = false;
  let codeLines = [];
  let inItem = false;
  let paragraphLines = [];
  let listDepth = 0;

  const closeItem = () => {
    flushParagraph();
    if (inItem) output.push('</div></article>');
    inItem = false;
  };
  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    output.push('<p class="body-para">' +
      paragraphLines.map(highlightInline).join('<br>') + '</p>');
    paragraphLines = [];
  };
  const renderStat = (line) => {
    const match = line.match(/^\s*([^=:\n]+?)\s*(=|:)\s*(.*?)\s*$/);
    if (!match) return null;
    return '<div class="stats-inline" data-role="bgCode">' +
      '<span class="code-key" data-role="textStatKey">' + escapeHtml(match[1]) + '</span>' +
      '<span class="code-eq">' + match[2] + '</span>' +
      '<span class="code-val" data-role="textStatValue">' + highlightInline(match[3]) + '</span></div>';
  };
  const renderCode = () => {
    const rows = codeLines.map((line) => {
      const stat = renderStat(line);
      return stat || '<div class="code-line">' + highlightInline(line) + '</div>';
    }).join('');
    output.push('<div class="stats-block" data-role="bgCode">' + rows + '</div>');
    codeLines = [];
  };
  const renderListLine = (line) => {
    const match = line.match(/^(\s*)([-*+] |•\s+)(.*)$/);
    if (!match) return false;
    flushParagraph();
    const depth = Math.floor(match[1].replace(/\t/g, '  ').length / 2);
    output.push('<div class="sub-bullet" style="margin-left:' + Math.min(depth, 8) * 18 +
      'px"><span class="sub-dot" data-role="textBullet">•</span><span>' +
      highlightInline(match[3]) + '</span></div>');
    listDepth = depth;
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    const original = lines[i];
    const line = original.trim();

    // Fenced blocks accept ordinary and bullet-prefixed fences.
    if (/^(?:[-*+]\s*)?`{3,}/.test(line)) {
      flushParagraph();
      if (!inCode) {
        closeItem();
        inCode = true;
        codeLines = [];
      } else {
        inCode = false;
        renderCode();
      }
      continue;
    }
    if (inCode) {
      codeLines.push(original);
      continue;
    }

    if (!line) {
      flushParagraph();
      if (inItem) output.push('<div class="para-spacer"></div>');
      listDepth = 0;
      continue;
    }

    // Markdown headings and standalone section labels.
    const heading = line.match(/^#{1,3}\s+(.+?)\s*#*$/);
    const section = line.match(/^\[?(Stats|Abilities|Passives|Resistances|Weaknesses|Traits|Equipment|Notes|Overview)\]?\s*:?$/i);
    if (heading || section) {
      flushParagraph();
      closeItem();
      const title = (heading ? heading[1] : section[1]).replace(/^\[|\]$/g, '').trim();
      const isStats = /^stats$/i.test(title);
      output.push('<' + (isStats ? 'h3' : 'h2') +
        ' class="section-header" data-role="textHeader">' + escapeHtml(title) +
        '</' + (isStats ? 'h3' : 'h2') + '>');
      continue;
    }

    // Stats outside a fenced block.
    const stat = renderStat(line);
    if (stat && !inItem) {
      flushParagraph();
      output.push(stat);
      continue;
    }

    // Generic item heading: [Name] followed by zero or more metadata groups.
    // Also supports a bullet prefix and a plain name followed by metadata.
    const item = line.match(/^(?:[-*+]\s*)?\[([^\]]+)\]\s*((?:\([^()]*\)\s*)*)$/);
    const plainItem = line.match(/^[-*+]\s+([^()[\]<>]{1,70}?)\s*((?:\([^()]*\)\s*)+)$/);
    if (item || plainItem) {
      flushParagraph();
      closeItem();
      const name = (item ? item[1] : plainItem[1]).trim();
      const metadata = (item ? item[2] : plainItem[2]).trim();
      output.push('<article class="tree-item"><div class="item-header">' +
        '<span class="bullet" data-role="textBullet">•</span>' +
        '<span class="item-title" data-role="textAbility">' + escapeHtml(name) + '</span>' +
        (metadata ? '<span class="item-meta" data-role="textMetadata">' +
          highlightInline(metadata) + '</span>' : '') +
        '</div><div class="indented-body" data-role="borderLine">');
      inItem = true;
      continue;
    }

    if (renderListLine(original)) continue;

    // A bare [Name] line can be an item title; references in prose remain inline.
    const bareItem = line.match(/^\[([^\]]+)\]$/);
    if (bareItem && (i + 1 < lines.length) && lines[i + 1].trim()) {
      flushParagraph();
      closeItem();
      output.push('<article class="tree-item"><div class="item-header">' +
        '<span class="bullet" data-role="textBullet">•</span>' +
        '<span class="item-title" data-role="textAbility">' + escapeHtml(bareItem[1]) +
        '</span></div><div class="indented-body" data-role="borderLine">');
      inItem = true;
      continue;
    }

    paragraphLines.push(line);
  }

  if (inCode) renderCode();
  flushParagraph();
  closeItem();

  return `
    <style>
      html, body { min-height:100%; margin:0; background:${theme.bgMain}; }
      body { color:${theme.textMain}; font:14.5px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
      #rendered-content { box-sizing:border-box; min-height:100%; padding:18px 22px; background:${theme.bgMain}; color:${theme.textMain}; overflow-wrap:anywhere; }
      h2.section-header { color:${theme.textHeader}; font-size:1.55em; font-weight:700; margin:26px 0 14px; padding-bottom:6px; border-bottom:1px solid #2b2b36; }
      h3.section-header { color:${theme.textHeader}; font-size:1.1em; font-weight:600; margin:0 0 10px; }
      .stats-block { box-sizing:border-box; background:${theme.bgCode}; border:1px solid #262633; border-radius:6px; padding:12px 16px; font:0.92em/1.65 "Fira Code","JetBrains Mono",Consolas,monospace; margin-bottom:22px; }
      .stats-inline { display:flex; flex-wrap:wrap; gap:8px; background:${theme.bgCode}; padding:3px 12px; font:0.92em/1.65 "Fira Code","JetBrains Mono",Consolas,monospace; }
      .code-key { color:${theme.textStatKey}; } .code-val { color:${theme.textStatValue}; } .code-eq { color:#abb2bf; }
      .tree-item { margin-bottom:20px; } .item-header { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px; margin-bottom:6px; }
      .bullet { color:${theme.textBullet}; margin-right:2px; } .item-title { color:${theme.textAbility}; font-weight:600; }
      .item-meta { color:${theme.textMetadata}; font-style:italic; } .indented-body { margin-left:4px; padding-left:16px; border-left:1.5px solid ${theme.borderLine}; }
      .body-para { margin:0 0 8px; } .para-spacer { height:8px; }
      .sub-bullet { display:flex; align-items:flex-start; gap:8px; margin-bottom:7px; } .sub-dot { color:${theme.textBullet}; line-height:1.5; flex:none; }
      .ability-ref { color:${theme.textReference}; font-weight:500; } .kw-num { color:${theme.textNumber}; font-style:italic; }
      .kw-dur { color:${theme.textDuration}; font-style:italic; } .inline-code { background:${theme.bgCode}; padding:1px 4px; border-radius:3px; }
      strong, em { color:${theme.textEmphasis}; } .code-line { white-space:pre-wrap; }
    </style>
    <div id="rendered-content" data-role="bgMain">${output.join('\n')}</div>
  `;
}
