# Orbit — Personal browser prototype

Orbit is a polished personal browser shell with a plain HTML/CSS/JavaScript interface and an optional Electron desktop runtime. It includes multi-tab controls, quick links, recent activity, command palette shortcuts, focus mode, switchable visual accents, live HTTP/HTTPS pages, and DuckDuckGo-powered search.

## Run locally

For the full desktop browser, install dependencies and start Electron:

```bash
npm install
npm start
```

The desktop runtime keeps remote pages isolated, denies permissions by default, blocks popups, and only permits HTTP/HTTPS navigation.

For a UI-only preview, use any static file server:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080> in a browser. Opening `index.html` directly also works, though live remote pages require the Electron runtime.

## Controls

- Submit the omnibox to search DuckDuckGo or load an HTTP/HTTPS URL.
- Select `+` to add tabs; click a tab or its `×` to switch and close.
- Click a quick-launch card to populate and load its address.
- Use `⌘K` / `Ctrl+K` for the command palette.
- Use the half-moon button to cycle Nebula, Aurora, and Solar accents.
