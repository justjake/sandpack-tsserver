(() => {
  // public/workers/tsserver.ts
  importScripts("https://unpkg.com/@typescript/vfs@1.3.5/dist/vfs.globals.js");
  importScripts("https://cdnjs.cloudflare.com/ajax/libs/typescript/4.4.3/typescript.min.js");
  importScripts("https://unpkg.com/@okikio/emitter@2.1.7/lib/api.js");
  var {
    createDefaultMapFromCDN,
    createSystem,
    createVirtualTypeScriptEnvironment
  } = globalThis.tsvfs;
  var ts = globalThis.ts;
  var EventEmitter = globalThis.emitter.EventEmitter;
  var _emitter = new EventEmitter();
  globalThis.localStorage = globalThis.localStorage ?? {};
  (async () => {
    const compilerOpts = {
      target: ts.ScriptTarget.ES2021,
      module: ts.ScriptTarget.ES2020,
      lib: ["es2021", "es2020", "dom", "webworker"],
      esModuleInterop: true
    };
    let initialText = "const hello = 'hi'";
    _emitter.once("updateText", (details) => {
      initialText = details.text.join("\n");
    });
    const fsMap = await createDefaultMapFromCDN(compilerOpts, ts.version, false, ts);
    const ENTRY_POINT = "index.tsx";
    fsMap.set(ENTRY_POINT, initialText);
    const reactTypes = await fetch("https://unpkg.com/@types/react@17.0.11/index.d.ts").then((data) => data.text());
    fsMap.set("/node_modules/@types/react/index.d.ts", reactTypes);
    const system = createSystem(fsMap);
    const env = createVirtualTypeScriptEnvironment(system, [ENTRY_POINT], ts, compilerOpts);
    postMessage({
      event: "ready",
      details: []
    });
    _emitter.on("updateText", (details) => {
      env.updateFile(ENTRY_POINT, [].concat(details.text).join("\n"));
    });
    _emitter.on("autocomplete-request", ({ pos }) => {
      let result = env.languageService.getCompletionsAtPosition(ENTRY_POINT, pos, {});
      postMessage({
        event: "autocomplete-results",
        details: result
      });
    });
    _emitter.on("tooltip-request", ({ pos }) => {
      let result = env.languageService.getQuickInfoAtPosition(ENTRY_POINT, pos);
      postMessage({
        event: "tooltip-results",
        details: result ? {
          result,
          tootltipText: ts.displayPartsToString(result.displayParts) + (result.documentation?.length ? "\n" + ts.displayPartsToString(result.documentation) : "")
        } : { result, tooltipText: "" }
      });
    });
    _emitter.on("lint-request", () => {
      let SyntacticDiagnostics = env.languageService.getSyntacticDiagnostics(ENTRY_POINT);
      let SemanticDiagnostic = env.languageService.getSemanticDiagnostics(ENTRY_POINT);
      let SuggestionDiagnostics = env.languageService.getSuggestionDiagnostics(ENTRY_POINT);
      let result = [].concat(SyntacticDiagnostics, SemanticDiagnostic, SuggestionDiagnostics);
      postMessage({
        event: "lint-results",
        details: result.map((v) => {
          let from = v.start;
          let to = v.start + v.length;
          let diag = {
            from,
            to,
            message: v.messageText,
            source: v?.source,
            severity: ["warning", "error", "info", "info"][v.category]
          };
          return diag;
        })
      });
    });
  })();
  addEventListener("message", ({ data }) => {
    let { event, details } = data;
    _emitter.emit(event, details);
  });
})();
