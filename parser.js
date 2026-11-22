/*
 * Trello Markdown HTML renderer.
 * Converts the lightweight card-description syntax into safe, themed HTML.
 */

const DEFAULT_THEME = Object.freeze({
  bgMain: "#181820",
  bgCode: "#1e1e28",
  textMain: "#dcddde",
  textHeader: "#a899e6",
  textAbility: "#6fa8dc",
  borderLine: "#324a5e",
  kwBlood: "#e06c75",
  kwHeal: "#98c379",
  kwNumber: "#d19a66",
  kwCrystal: "#61afef"
});

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/*
 * Only accept six-digit hex colors. This prevents saved theme data from
 * injecting arbitrary CSS into the rendered card.
 */
function normalizeTheme(theme = {}) {
  const normalized = {};

  for (const [key, fallback] of Object.entries(DEFAULT_THEME)) {
    const candidate = theme && theme[key];
    normalized[key] =
      typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate)
        ? candidate
        : fallback;
  }

  return normalized;
}

function highlightInlineText(value) {
  let html = escapeHtml(value);

  html = html.replace(
    /\b(blood|bleed|bleeding)\b/gi,
    '<span class="kw-blood" data-role="kwBlood">$1</span>'
  );

  html = html.replace(
    /\b(heal|healing|heals)\b/gi,
    '<span class="kw-heal" data-role="kwHeal">$1</span>'
  );

  html = html.replace(
    /\b(crystalized|crystallized|crystal|crystals)\b/gi,
    '<span class="kw-crystal" data-role="kwCrystal">$1</span>'
  );

  html = html.replace(
    /(\b\d+(?:\.\d+)?%?(?:\s*[+\-*/]\s*\d+(?:\.\d+)?)?\b)/g,
    '<span class="kw-num" data-role="kwNumber">$1</span>'
  );

  return html;
}

function parseTrelloMarkdown(rawText, suppliedTheme = DEFAULT_THEME) {
  const theme = normalizeTheme(suppliedTheme);
  const lines = String(rawText || "").replace(/\r\n?/g, "\n").split("\n");

  const renderedLines = lines.map((line) => {
    const sectionMatch = line.match(/^\[(Stats|Abilities|Passives)\]$/i);

    if (sectionMatch) {
      return `<h2 data-role="textHeader">${escapeHtml(sectionMatch[1])}</h2>`;
    }

    const abilityMatch = line.match(/^\[([^\]]+)\](.*)$/);

    if (abilityMatch) {
      return `
        <div class="item-header">
          <span class="bullet" aria-hidden="true">•</span>
          <span class="title" data-role="textAbility">${escapeHtml(abilityMatch[1])}</span>
          <span class="meta" data-role="textHeader">${highlightInlineText(abilityMatch[2])}</span>
        </div>
      `;
    }

    const bulletMatch = line.match(/^-+\s+(.*)$/);

    if (bulletMatch) {
      return `<div class="sub-item">• ${highlightInlineText(bulletMatch[1])}</div>`;
    }

    if (!line.trim()) {
      return '<div class="line-spacer" aria-hidden="true"></div>';
    }

    return `<p class="text-line" data-role="textMain">${highlightInlineText(line)}</p>`;
  });

  return `
    <style>
      #rendered-content {
        --bg-main: ${theme.bgMain};
        --bg-code: ${theme.bgCode};
        --text-main: ${theme.textMain};
        --text-header: ${theme.textHeader};
        --text-ability: ${theme.textAbility};
        --border-line: ${theme.borderLine};
        --kw-blood: ${theme.kwBlood};
        --kw-heal: ${theme.kwHeal};
        --kw-number: ${theme.kwNumber};
        --kw-crystal: ${theme.kwCrystal};

        box-sizing: border-box;
        min-height: 100%;
        padding: 20px;
        background: var(--bg-main);
        color: var(--text-main);
        font: 14px/1.6 Arial, sans-serif;
        overflow-wrap: anywhere;
      }

      #rendered-content * { box-sizing: border-box; }
      #rendered-content h2 {
        margin: 18px 0 10px;
        padding-bottom: 4px;
        color: var(--text-header);
        border-bottom: 1px solid var(--border-line);
        font-size: 1.25rem;
      }
      #rendered-content h2:first-child { margin-top: 0; }
      #rendered-content .item-header {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 6px;
        margin: 12px 0 4px;
      }
      #rendered-content .bullet { color: var(--text-ability); }
      #rendered-content .title {
        color: var(--text-ability);
        font-weight: 700;
      }
      #rendered-content .meta {
        color: var(--text-header);
        font-style: italic;
      }
      #rendered-content .sub-item {
        margin: 3px 0 3px 12px;
        padding-left: 12px;
        border-left: 2px solid var(--border-line);
      }
      #rendered-content .text-line { margin: 5px 0; }
      #rendered-content .line-spacer { height: 8px; }
      #rendered-content .kw-num {
        color: var(--kw-number);
        font-style: italic;
      }
      #rendered-content .kw-blood { color: var(--kw-blood); }
      #rendered-content .kw-heal { color: var(--kw-heal); }
      #rendered-content .kw-crystal { color: var(--kw-crystal); }
    </style>
    <div id="rendered-content">${renderedLines.join("")}</div>
  `;
}
