export function buildIframeDoc(compiledJS: string): string {
  // JSON.stringify yields a valid JS string literal for any input; escaping
  // "<" additionally prevents "</script>" inside user code from closing the
  // host <script> element early.
  const codeLiteral = JSON.stringify(compiledJS).replace(/</g, "\\u003c");
  return `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, sans-serif; background: #fff; color: #111; }
    </style>

    <!-- Import map: redirect bare imports to esm.sh CDN -->
    <script type="importmap">
    {
      "imports": {
        "react":             "https://esm.sh/react@19",
        "react-dom":         "https://esm.sh/react-dom@19",
        "react-dom/client":  "https://esm.sh/react-dom@19/client",
        "react/jsx-runtime": "https://esm.sh/react@19/jsx-runtime"
      }
    }
    </script>
  </head>
  <body>
    <div id="root"></div>

    <script type="module">
      // Global error handler — shows errors inside preview instead of silently failing
      window.onerror = (msg, src, line, col, err) => {
        document.getElementById('root').innerHTML = \`
          <div style="padding:16px;color:#c00;font-family:monospace;white-space:pre-wrap">
            <strong>Runtime Error</strong>\\n\${err?.stack || msg}
          </div>\`;
      };

      try {
        // Dynamically import the compiled user code as an ES module
        const code = ${codeLiteral};
        const dataURL = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(code);
        const mod = await import(dataURL);

        // Mount default export as root React component
        const { default: App } = mod;
        if (!App) throw new Error('No default export found. Export a default component.');

        const { createRoot } = await import('react-dom/client');
        createRoot(document.getElementById('root')).render(
          (await import('react')).createElement(App)
        );
      } catch (err) {
        document.getElementById('root').innerHTML = \`
          <div style="padding:16px;color:#c00;font-family:monospace;white-space:pre-wrap">
            <strong>Error</strong>\\n\${err.message}
          </div>\`;
      }
    </script>
  </body>
</html>`;
}