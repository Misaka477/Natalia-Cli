export const exampleWebUiStyles = `
:root {
  --bg: #0e1014;
  --panel: #14181f;
  --raised: #1b212b;
  --line: #262c36;
  --text: #eceff3;
  --muted: #8b93a0;
  --faint: #5d6673;
  --accent: #7aa2ff;
  --ok: #3dd68c;
  --warn: #e0b15a;
  --danger: #e25d4a;
  --user: #1c2533;
}
* { box-sizing: border-box; }
.natalia-web {
  display: grid;
  grid-template-columns: 244px minmax(0, 1fr) 380px;
  height: 100%;
  min-height: 0;
  color: var(--text);
  background: var(--bg);
  font: 13.5px/1.45 "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;
}
.natalia-web__nav, .natalia-web__pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.natalia-web__nav {
  background: #12151b;
  border-right: 1px solid var(--line);
}
.natalia-web__brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 14px 10px;
}
.natalia-web__mark {
  width: 22px; height: 22px; border-radius: 7px;
  background: linear-gradient(135deg, #8eb4ff, #3d6fbf);
}
.natalia-web__brand strong { display: block; font-size: 14px; }
.natalia-web__brand span { color: var(--faint); font-size: 11px; }
.natalia-web__new {
  margin: 0 12px 10px;
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--raised);
  color: var(--text);
  font: inherit;
}
.natalia-web__tree { flex: 1; overflow: auto; padding: 4px 8px 16px; }
.natalia-web__label {
  padding: 10px 8px 4px;
  color: var(--faint);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.natalia-web__workspace, .natalia-web__session {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 7px 8px; border: 0; background: transparent; color: var(--text);
  border-radius: 8px; font: inherit; text-align: left;
}
.natalia-web__workspace { color: var(--muted); font-size: 12px; }
.natalia-web__session[data-active="true"],
.natalia-web__workspace:hover, .natalia-web__session:hover { background: var(--raised); }
.natalia-web__sessions { margin: 0 0 6px 6px; }
.natalia-web__dot {
  width: 7px; height: 7px; border-radius: 50%; background: var(--faint); flex: 0 0 auto;
}
.natalia-web__dot[data-state="running"] { background: var(--ok); box-shadow: 0 0 0 3px #3dd68c22; }
.natalia-web__session small { margin-left: auto; color: var(--faint); font-size: 10px; }
.natalia-web__pane { background: var(--bg); }
.natalia-web__pane--chat { background: var(--panel); border-left: 1px solid var(--line); }
.natalia-web__head {
  display: flex; align-items: center; gap: 10px; min-height: 46px;
  padding: 0 16px; border-bottom: 1px solid var(--line);
}
.natalia-web__head h2 { margin: 0; font-size: 13px; font-weight: 600; }
.natalia-web__head p { margin: 0; color: var(--muted); font-size: 12px; }
.natalia-web__pill {
  margin-left: auto; padding: 3px 8px; border-radius: 999px;
  background: var(--raised); color: var(--muted); font-size: 11px;
}
.natalia-web__pill[data-live="true"] { color: var(--ok); background: #143024; }
.natalia-web__thread { flex: 1; min-height: 0; overflow: auto; padding: 18px 18px 12px; }
.natalia-web__empty {
  height: 100%; display: grid; place-items: center; color: var(--faint); text-align: center;
}
.natalia-web__empty strong { display: block; color: var(--muted); font-size: 16px; margin-bottom: 6px; }
.natalia-web__message { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 10px; margin: 0 0 16px; }
.natalia-web__avatar {
  width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center;
  background: var(--raised); color: var(--muted); font-size: 11px; font-weight: 700;
}
.natalia-web__message--user .natalia-web__avatar { background: #243044; color: var(--accent); }
.natalia-web__message--assistant .natalia-web__avatar { background: #1b2a22; color: var(--ok); }
.natalia-web__bubble header { display: flex; gap: 8px; color: var(--muted); font-size: 11px; margin-bottom: 4px; }
.natalia-web__bubble pre { margin: 0; white-space: pre-wrap; word-break: break-word; font: inherit; }
.natalia-web__message--user .natalia-web__bubble {
  background: var(--user); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px;
}
.natalia-web__message--thinking pre { color: var(--muted); font-style: italic; }
.natalia-web__dock { padding: 10px 12px 12px; border-top: 1px solid var(--line); }
.natalia-web__composer {
  display: flex; flex-direction: column; gap: 8px; padding: 10px;
  border: 1px solid var(--line); border-radius: 14px; background: var(--raised);
}
.natalia-web__composer textarea {
  width: 100%; min-height: 64px; resize: none; border: 0; outline: none;
  background: transparent; color: inherit; font: inherit;
}
.natalia-web__bar { display: flex; align-items: center; gap: 6px; }
.natalia-web__bar select {
  max-width: 150px; background: var(--bg); color: inherit; border: 1px solid var(--line);
  border-radius: 8px; padding: 5px 8px; font: inherit;
}
.natalia-web button {
  background: #2b64d9; color: #fff; border: 0; border-radius: 8px;
  padding: 7px 11px; font: inherit; cursor: pointer;
}
.natalia-web button[data-kind="ghost"] { background: transparent; color: var(--muted); border: 1px solid var(--line); }
.natalia-web button[data-kind="stop"], .natalia-web button[data-kind="reject"] { background: var(--danger); }
.natalia-web__send { margin-left: auto; }
.natalia-web__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.natalia-web__chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px;
  border-radius: 999px; background: #222833; color: var(--muted); font-size: 11px;
}
.natalia-web__chip button { padding: 0; background: transparent; color: var(--faint); }
.natalia-web__card {
  margin-bottom: 8px; padding: 12px; border: 1px solid #33405a;
  border-radius: 12px; background: #171d28;
}
.natalia-web__card h3 { margin: 0 0 6px; font-size: 13px; }
.natalia-web__card p { margin: 0 0 10px; color: var(--muted); }
.natalia-web__actions { display: flex; flex-wrap: wrap; gap: 6px; }
.natalia-web__toast {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  padding: 8px 12px; border-radius: 8px; background: #2a2418; color: var(--warn); z-index: 4;
}
.natalia-web__toggle { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
@media (max-width: 1100px) {
  .natalia-web { grid-template-columns: 220px minmax(0,1fr); }
  .natalia-web__pane--chat { display: none; }
}
@media (max-width: 760px) {
  .natalia-web { grid-template-columns: 1fr; }
  .natalia-web__nav { display: none; }
}
`;
