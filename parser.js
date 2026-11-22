const DEFAULT_THEME = {
  bgMain: '#181820',
  bgCode: '#1e1e28',
  textMain: '#dcddde',
  textHeader: '#a899e6',
  textAbility: '#6fa8dc',
  borderLine: '#324a5e',
  kwBlood: '#e06c75',
  kwHeal: '#98c379',
  kwNumber: '#d19a66',
  kwCrystal: '#61afef'
};

function parseTrelloMarkdown(rawText, theme = DEFAULT_THEME) {
  let html = rawText
    // Escape HTML characters safely
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    // Convert [Section] headers
    .replace(/^\[(Stats|Abilities|Passives)\]$/gm, '<h2 data-role="textHeader">$1</h2>')
    // Convert [Ability Name](Meta)
    .replace(/^\[([^\]]+)\](.*)$/gm, '<div class="item-header"><span class="bullet">•</span> <span class="title" data-role="textAbility">$1</span> <span class="meta" data-role="textHeader">$2</span></div>')
    // Convert bullet points
    .replace(/^- (.*)$/gm, '<div class="sub-item">• $1</div>')
    // Highlight numbers & formulas
    .replace(/(\b\d+%?(?:\s*[\+\-\*\/]\s*\([^)]+\))?)/g, '<span class="kw-num" data-role="kwNumber">$1</span>')
    // Highlight specific keywords
    .replace(/\b(blood|bleed|bleeding)\b/gi, '<span class="kw-blood" data-role="kwBlood">$1</span>')
    .replace(/\b(heal|healing)\b/gi, '<span class="kw-heal" data-role="kwHeal">$1</span>')
    .replace(/\b(crystalized)\b/gi, '<span class="kw-crystal" data-role="kwCrystal">$1</span>')
    // Line breaks
    .replace(/\n/g, '<br>');

  return `
    <style>
      body { background: ${theme.bgMain}; color: ${theme.textMain}; font-family: sans-serif; padding: 20px; line-height: 1.6; }
      h2 { color: ${theme.textHeader}; border-bottom: 1px solid ${theme.borderLine}; padding-bottom: 4px; }
      .title { color: ${theme.textAbility}; font-weight: bold; }
      .meta { color: ${theme.textHeader}; font-style: italic; }
      .sub-item { margin-left: 12px; padding-left: 12px; border-left: 2px solid ${theme.borderLine}; }
      .kw-num { color: ${theme.kwNumber}; font-style: italic; }
      .kw-blood { color: ${theme.kwBlood}; }
      .kw-heal { color: ${theme.kwHeal}; }
      .kw-crystal { color: ${theme.kwCrystal}; }
    </style>
    <div id="rendered-content">${html}</div>
  `;
}
