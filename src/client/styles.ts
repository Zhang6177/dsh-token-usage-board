export const styles = String.raw`
[data-token-usage-board] {
  --us-bg: var(--dsw-alias-bg-base, #ffffff);
  --us-surface: color-mix(in srgb, var(--dsw-alias-bg-layer-1, #f5f5f5) 92%, var(--us-bg));
  --us-raised: var(--dsw-alias-bg-layer-2, #ffffff);
  --us-hover: var(--dsw-alias-interactive-bg-hover, #eef1f4);
  --us-text: var(--dsw-alias-label-primary, #17191c);
  --us-muted: var(--dsw-alias-label-secondary, #747b86);
  --us-border: var(--dsw-alias-border-l1, #e4e7eb);
  --us-accent: #1677ff;
  --us-shadow-soft: 0 1px 2px rgba(18, 26, 41, .03), 0 8px 28px rgba(18, 26, 41, .035);
  color: var(--us-text);
  font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif);
  font-size: 14px;
  box-sizing: border-box;
}
[data-token-usage-board], [data-token-usage-board] button, [data-token-usage-board] input, [data-token-usage-board] select { font-family: var(--dsw-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif); }
body[data-ds-dark-theme] [data-token-usage-board] {
  --us-bg: var(--dsw-alias-bg-base, #18191c);
  --us-surface: var(--dsw-alias-bg-layer-1, #222428);
  --us-raised: var(--dsw-alias-bg-layer-2, #292b30);
  --us-hover: var(--dsw-alias-interactive-bg-hover, #31343a);
  --us-text: var(--dsw-alias-label-primary, #f2f3f5);
  --us-muted: var(--dsw-alias-label-secondary, #a6acb5);
  --us-border: var(--dsw-alias-border-l1, #35383e);
}
[data-token-usage-board] *, [data-token-usage-board] *::before, [data-token-usage-board] *::after { box-sizing: border-box; }

/* --- center-column takeover (global rules, attribute-scoped) ---------------
   Same single-occupant protocol as dsh-client-ui-task-board / cron-explorer:
   the dashboard rides inside the conversation column as an extra trailing
   child; toggling is a data attribute on <html>; the conversation subtree
   underneath stays mounted and stateful. */
[data-pane='conversation'],
[class*='centerCol'] {
  position: relative;
}
[data-dsh-token-usage-board-view] {
  position: absolute;
  inset: 0;
  display: none;
  z-index: 60;
  /* Opaque backdrop: the conversation subtree stays mounted underneath. */
  background: var(--dsw-alias-bg-base, #ffffff);
}
html[data-dsh-token-usage-board-active] [data-dsh-token-usage-board-view] {
  display: block;
}
/* While the panel is active, the conversation content underneath is hidden.
   The !important is required: the dsh shell wraps the conversation view in a
   node with an inline "display: contents", and inline styles beat a plain
   stylesheet rule. Without it the composer (input card) stays visible at the
   bottom and paints over the panel. */
html[data-dsh-token-usage-board-active] [data-pane='conversation'] > :not([data-dsh-token-usage-board-view]),
html[data-dsh-token-usage-board-active] [class*='centerCol'] > :not([data-dsh-token-usage-board-view]) {
  display: none !important;
}

.us-nav { width: 100%; height: 38px; border: 0; border-radius: 10px; display: flex; align-items: center; justify-content: flex-start; gap: 10px; padding: 0 10px; color: var(--us-muted); background: transparent; cursor: pointer; font: inherit; }
.us-nav:hover { color: var(--us-text); background: var(--us-hover); }
.us-nav[data-active] { color: var(--us-text); background: var(--us-hover); font-weight: 600; }
.us-nav[data-rail="true"] { width: 36px; padding: 0; justify-content: center; }
.us-nav svg { flex: none; }
.us-shell { height: 100%; display: flex; flex-direction: column; background: var(--us-bg); overflow: hidden; animation: us-enter 180ms ease-out; }
.us-top { min-height: 90px; flex: none; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px clamp(24px, 4vw, 58px) 10px; }
.us-heading { display: flex; align-items: flex-end; gap: 20px; }
.us-title { font-size: clamp(28px, 3vw, 40px); line-height: 1.12; font-weight: 750; letter-spacing: -.045em; }
.us-tab { position: relative; padding: 0 2px 9px; font-size: 16px; color: var(--us-text); }
.us-tab::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; border-radius: 2px; background: var(--us-text); }
.us-back { height: 40px; display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 12px; padding: 0 14px; color: var(--us-muted); background: transparent; cursor: pointer; font: inherit; transition: color 150ms ease, background 150ms ease, transform 150ms ease; }
.us-back:hover { color: var(--us-text); background: var(--us-hover); transform: translateX(-2px); }
.us-scroll { overflow: auto; scrollbar-gutter: stable; padding: 10px clamp(24px, 4vw, 58px) 40px; }
.us-content { width: min(1180px, 100%); margin: 0 auto; }
.us-export { height: 38px; display: inline-flex; align-items: center; gap: 7px; border: 0; border-radius: 10px; padding: 0 12px; background: transparent; color: var(--us-muted); text-decoration: none; font-size: 13px; transition: color 140ms ease, background 140ms ease; }
.us-export:hover { color: var(--us-text); background: var(--us-hover); }
.us-panel { border: 1px solid color-mix(in srgb, var(--us-border) 55%, transparent); background: var(--us-surface); border-radius: 16px; box-shadow: var(--us-shadow-soft); margin-top: 14px; padding: 18px 20px; overflow: hidden; animation: us-panel-in 380ms 90ms both; }
.us-panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.us-panel-title { font-size: 16px; font-weight: 620; }
.us-panel-note { color: var(--us-muted); font-size: 12px; }
.us-spacer { flex: 1; }
.us-segment { display: inline-flex; gap: 3px; padding: 3px; border: 1px solid var(--us-border); border-radius: 11px; background: var(--us-raised); }
.us-segment button { border: 0; min-width: 64px; padding: 6px 12px; border-radius: 8px; color: var(--us-muted); background: transparent; cursor: pointer; font: inherit; white-space: nowrap; }
.us-segment button[aria-pressed="true"] { color: var(--us-text); background: var(--us-hover); box-shadow: 0 1px 3px rgba(0,0,0,.06); }
.us-stats-strip { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); border: 1px solid color-mix(in srgb, var(--us-border) 55%, transparent); background: var(--us-surface); border-radius: 16px; box-shadow: var(--us-shadow-soft); animation: us-card-in 320ms both; }
.us-stat-cell { min-width: 0; padding: 16px 18px; border-left: 1px solid color-mix(in srgb, var(--us-border) 45%, transparent); }
.us-stat-cell:first-child { border-left: 0; }
.us-stat-value { overflow: hidden; font-size: 22px; line-height: 1.25; font-weight: 700; letter-spacing: -.02em; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.us-stat-label { margin-top: 5px; color: var(--us-muted); font-size: 12px; white-space: nowrap; }
.us-heat-scroll { display: flex; align-items: flex-start; gap: 8px; width: 100%; overflow: visible; padding: 8px 4px 4px; }
.us-heat-week { flex: none; display: grid; grid-template-rows: repeat(7, 15px); gap: 4px; width: 14px; color: var(--us-muted); font-size: 10px; line-height: 15px; }
.us-heat-week span:nth-child(2) { grid-row: 3; }
.us-heat-week span:nth-child(3) { grid-row: 5; }
.us-heat-body { flex: 1; min-width: 0; }
.us-heat { display: grid; grid-template-rows: repeat(7, auto); grid-template-columns: repeat(53, minmax(0, 1fr)); grid-auto-flow: column; gap: clamp(2px, .28vw, 4px); width: 100%; }
.us-cell { width: 100%; max-width: 15px; aspect-ratio: 1; justify-self: center; border-radius: 3px; display: inline-block; background: color-mix(in srgb, var(--us-border) 66%, transparent); }
.us-cell[data-level="1"] { background: #d6e9ff; }
.us-cell[data-level="2"] { background: #a9d1ff; }
.us-cell[data-level="3"] { background: #72b2ff; }
.us-cell[data-level="4"] { background: #368ef2; }
.us-cell[data-level="5"] { background: #1068ca; }
body[data-ds-dark-theme] .us-cell[data-level="0"] { background: color-mix(in srgb, var(--us-border) 40%, transparent); }
body[data-ds-dark-theme] .us-cell[data-level="1"] { background: #173b63; }
body[data-ds-dark-theme] .us-cell[data-level="2"] { background: #1d568f; }
body[data-ds-dark-theme] .us-cell[data-level="3"] { background: #2173bd; }
body[data-ds-dark-theme] .us-cell[data-level="4"] { background: #2b91e9; }
body[data-ds-dark-theme] .us-cell[data-level="5"] { background: #67b7ff; }
.us-heat-months { display: grid; grid-template-columns: repeat(53, minmax(0, 1fr)); gap: clamp(2px, .28vw, 4px); width: 100%; margin-top: 6px; }
.us-heat-months span { overflow: visible; color: var(--us-muted); font-size: 11px; white-space: nowrap; }

.us-cell-tip { position: relative; cursor: default; outline: none; transition: transform 90ms ease, box-shadow 90ms ease; }
.us-cell-tip:hover, .us-cell-tip:focus-visible { box-shadow: 0 0 0 2px var(--us-bg), 0 0 0 3px var(--us-text); z-index: 3; transform: scale(1.12); }
.us-floating-tip { position: fixed; z-index: 200; transform: translate(-50%, -100%); width: max-content; max-width: min(360px, calc(100vw - 24px)); padding: 9px 11px; border: 1px solid var(--us-border); border-radius: 10px; color: var(--us-text); background: color-mix(in srgb, var(--us-raised) 94%, transparent); box-shadow: 0 12px 38px rgba(0,0,0,.16); backdrop-filter: blur(14px); font-size: 12px; line-height: 1.4; pointer-events: none; animation: us-tip-in 110ms ease-out; }
.us-bars { display: flex; align-items: stretch; gap: clamp(2px, .4vw, 6px); height: 220px; padding: 12px 4px 0; }
.us-bar-slot { min-width: 0; flex: 1 1 0; height: 100%; display: grid; grid-template-rows: minmax(0, 1fr) 18px; align-items: end; }
.us-bar { width: min(72%, 20px); min-width: 3px; justify-self: center; border-radius: 3px 3px 0 0; background: var(--us-accent); outline: none; cursor: default; animation: us-bar-in 520ms cubic-bezier(.2,.8,.2,1) both; }
.us-bar:hover { filter: saturate(1.12) brightness(1.05); }
.us-bar:focus-visible { box-shadow: 0 0 0 2px var(--us-bg), 0 0 0 3px var(--us-text); }
.us-bar-label { align-self: start; justify-self: center; color: var(--us-muted); font-size: 11px; line-height: 18px; white-space: nowrap; }
.us-activity-controls { display: inline-flex; align-items: center; gap: 14px; }
.us-cum-wrap { padding: 4px 4px 0; }
.us-cum-frame { position: relative; height: 220px; }
.us-cum-frame svg { display: block; width: 100%; height: 100%; }
.us-cum-area { fill: color-mix(in srgb, var(--us-accent) 16%, transparent); }
.us-cum-line { fill: none; stroke: var(--us-accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
.us-cum-peak { position: absolute; right: 4px; top: 0; color: var(--us-muted); font-size: 11px; pointer-events: none; }
.us-cum-guide { position: absolute; top: 0; bottom: 0; width: 1px; background: color-mix(in srgb, var(--us-text) 32%, transparent); pointer-events: none; }
.us-cum-dot { position: absolute; width: 10px; height: 10px; transform: translate(-50%, -50%); border-radius: 50%; background: var(--us-accent); box-shadow: 0 0 0 2px var(--us-surface); pointer-events: none; }
.us-duo { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 14px; }
.us-duo .us-panel { margin-top: 0; }
.us-duo-row { display: flex; align-items: baseline; justify-content: space-between; gap: 14px; padding: 11px 2px; border-bottom: 1px solid color-mix(in srgb, var(--us-border) 55%, transparent); }
.us-duo-row:last-child { border-bottom: 0; }
.us-duo-label { color: var(--us-text); font-size: 13.5px; }
.us-duo-value { font-weight: 640; font-variant-numeric: tabular-nums; white-space: nowrap; }
.us-duo-sub { margin-top: 6px; color: var(--us-muted); font-size: 12px; }
.us-skill-row { display: flex; align-items: center; gap: 10px; padding: 10px 2px; border-bottom: 1px solid color-mix(in srgb, var(--us-border) 55%, transparent); }
.us-skill-row:last-child { border-bottom: 0; }
.us-skill-mark { flex: none; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px; color: var(--us-accent); background: color-mix(in srgb, var(--us-accent) 12%, transparent); font-size: 12px; font-weight: 700; }
.us-skill-name { min-width: 0; overflow: hidden; font-weight: 580; text-overflow: ellipsis; white-space: nowrap; }
.us-skill-count { margin-left: auto; flex: none; color: var(--us-muted); font-size: 12.5px; font-variant-numeric: tabular-nums; }
.us-pie-layout { display: grid; grid-template-columns: 220px 1fr; align-items: center; gap: 28px; }
.us-pie { width: 190px; aspect-ratio: 1; margin: auto; border-radius: 50%; display: grid; place-items: center; position: relative; }
.us-pie::after { content: ''; position: absolute; inset: 30px; border-radius: 50%; background: var(--us-surface); }
.us-pie-center { z-index: 1; text-align: center; font-weight: 700; font-size: 22px; font-variant-numeric: tabular-nums; }
.us-pie-center small { display: block; margin-top: 3px; color: var(--us-muted); font-weight: 400; font-size: 11px; }
.us-pie-legend { display: grid; gap: 2px; }
.us-pie-row { display: grid; grid-template-columns: 12px minmax(0, 1fr) auto auto; align-items: center; gap: 10px; padding: 8px 8px; border-bottom: 1px solid color-mix(in srgb, var(--us-border) 45%, transparent); border-radius: 8px; }
.us-pie-row:last-child { border-bottom: 0; }
.us-pie-row[data-active] { background: var(--us-hover); }
.us-pie-dot { width: 9px; height: 9px; border-radius: 50%; }
.us-pie-name { overflow: hidden; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
.us-pie-tokens { color: var(--us-muted); font-size: 12px; font-variant-numeric: tabular-nums; }
.us-pie-percent { min-width: 46px; text-align: right; font-size: 12.5px; font-weight: 600; font-variant-numeric: tabular-nums; }
.us-state { min-height: 420px; display: grid; place-items: center; color: var(--us-muted); text-align: center; }
.us-spinner { width: 28px; height: 28px; margin: 0 auto 14px; border: 3px solid var(--us-border); border-top-color: var(--us-accent); border-radius: 50%; animation: us-spin .8s linear infinite; }
@keyframes us-spin { to { transform: rotate(360deg); } }
@keyframes us-enter { from { opacity: 0; transform: translateY(4px); } }
@keyframes us-card-in { from { opacity: 0; transform: translateY(8px); } }
@keyframes us-panel-in { from { opacity: 0; transform: translateY(10px); } }
@keyframes us-bar-in { from { transform: scaleY(0); opacity: .25; } }
@keyframes us-tip-in { from { opacity: 0; transform: translate(-50%, calc(-100% + 4px)); } }
@media (max-width: 900px) { .us-stats-strip { grid-template-columns: repeat(2, minmax(0,1fr)); } .us-stat-cell { border-left: 0; border-top: 1px solid color-mix(in srgb, var(--us-border) 45%, transparent); } .us-stat-cell:nth-child(-n+2) { border-top: 0; } .us-stat-cell:nth-child(2n) { border-left: 1px solid color-mix(in srgb, var(--us-border) 45%, transparent); } .us-duo { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .us-top { min-height: 88px; } .us-heading { gap: 12px; } .us-tab { display: none; } .us-pie-layout { grid-template-columns: 1fr; } }
@media (max-width: 480px) { .us-stats-strip { grid-template-columns: 1fr; } .us-stat-cell { border-left: 0 !important; } .us-stat-cell:nth-child(n+2) { border-top: 1px solid color-mix(in srgb, var(--us-border) 45%, transparent); } }
@media (prefers-reduced-motion: reduce) { .us-shell, .us-spinner, .us-bar, .us-stats-strip, .us-panel, .us-floating-tip { animation: none; transition: none; } }
`