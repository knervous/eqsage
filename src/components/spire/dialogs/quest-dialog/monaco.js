// Scoped once to module so we can make the iframe a single instance and reference
const iframeId = `intellisage-${generateId()}`;

export class MonacoService {
  /**
   * @type {import('@monaco-editor/react').Monaco}
   */
  monaco = null;
  lastCompletions = null;
  intellisage = null;
  lang = 'csharp';

  constructor() {
    this.debouncedResolveCompletionItem = debounce(
      this.resolveCompletionItem.bind(this),
      250
    );
    this.debouncedProvideCompletionItems = debounce(
      this.provideCompletionItems.bind(this),
      250
    );
    this.debouncedGetDiagnosticsAsync = debounce(
      this.getDiagnosticsAsync.bind(this),
      2000
    );
  }

  async initialize(monaco, iframeUrl = 'https://intellisage.vercel.app/') {
    this.monaco = monaco;
    if (!this.monaco) {
      throw new Error('Monaco instance was not defined');
    }
    this.model = this.monaco.editor.getModels()?.[0];
    if (!this.model) {
      throw new Error('Monaco did not have an editor model');
    }

    // Load or reference our iframe and wait for the loaded callback
    let iframe = document.getElementById(iframeId);
    if (!iframe) {
      // Define initialization listener handler before loading iframe
      const initPromise = new Promise(res => {
        const listener = (event) => {
          if (event.data?.intellisageInitialized) {
            res();
            window.removeEventListener('message', listener);
          }
        };
        window.addEventListener('message', listener);
      });

      iframe = document.createElement('iframe');
      document.body.appendChild(iframe);
      iframe.id = iframeId;
      iframe.width = 0;
      iframe.height = 0;
      iframe.src = iframeUrl;
      iframe.title = 'IntelliSage';
      
      await new Promise((res, rej) => {
        iframe.onload = res;
        iframe.onerror = rej;
      });

      // Now we can await the initialization callback
      await initPromise;
    }

    this.intellisage = (method, ...args) => {
      if (!iframe?.contentWindow) {
        return;
      }
      return new Promise(res => {
        const id = generateId(); // Generate a unique ID for the message
        let handled = false;
        // Listener for the response from the child
        function handleMessage(event) {
          if (
            event.data?.intellisage &&
            event.data.intellisage.id === id &&
            !handled
          ) {
            window.removeEventListener('message', handleMessage);
            res(event.data.intellisage.payload);
          }
        }

        // Cleanup if we haven't received a response in a long time
        setTimeout(() => {
          if (!handled) {
            window.removeEventListener('message', handleMessage);
            res(false);
            handled = true;
          }
        }, 10000);

        window.addEventListener('message', handleMessage);
        iframe.contentWindow?.postMessage(
          {
            intellisage: {
              method: method,
              args  : args,
              id    : id,
            },
          },
          '*'
        );
      });
    };

    // Get one diagnostic check to start and listen for changes
    this.debouncedGetDiagnosticsAsync(this.model.getValue());
    this.model.onDidChangeContent(() => {
      if (this.lang !== 'csharp') {
        return;
      }
      this.debouncedGetDiagnosticsAsync(this.model.getValue());
    });


    // Register completion providers
    monaco.languages.registerCompletionItemProvider('csharp', {
      triggerCharacters    : ['.'],
      resolveCompletionItem: (_model, _position, item) => {
        return this.debouncedResolveCompletionItem(item);
      },
      provideCompletionItems: (model, position, context) => {
        return this.debouncedProvideCompletionItems(model, position, context);
      },
    });

    // Signature help provider
    monaco.languages.registerSignatureHelpProvider('csharp', {
      signatureHelpTriggerCharacters: ['('],
      provideSignatureHelp          : (model, position) => {
        return this.provideSignatureHelp(model, position);
      },
    });

    // Hover provider
    monaco.languages.registerHoverProvider('csharp', {
      provideHover: (model, position) => {
        return this.provideHover(model, position);
      },
    });
  }

  dispose() {}

  async getDiagnosticsAsync(code) {
    const diagnostics = await this.intellisage('GetDiagnosticsAsync', code);
    if (diagnostics) {
      this.setDiagnostics(diagnostics);
    }
  }

  async provideCompletionItems(model, position, context) {
    const request = this._createRequest(position);
    request.CompletionTrigger = context.triggerKind + 1;
    request.TriggerCharacter = context.triggerCharacter;

    try {
      const code = model.getValue();
      const response = await this.intellisage(
        'GetCompletionAsync',
        code,
        request
      );
      if (!response) {
        return { suggestions: [] };
      }
      const mappedItems = response.items.map(
        this._convertToVscodeCompletionItem
      );

      const lastCompletions = new Map();

      for (let i = 0; i < mappedItems.length; i++) {
        lastCompletions.set(mappedItems[i], response.items[i]);
      }

      this.lastCompletions = lastCompletions;

      return { suggestions: mappedItems };
    } catch (error) {
      console.warn('Error', error);
      return { suggestions: [] };
    }
  }

  async resolveCompletionItem(item) {
    const lastCompletions = this.lastCompletions;
    if (!lastCompletions) {
      return item;
    }

    const lspItem = lastCompletions.get(item);
    if (!lspItem) {
      return item;
    }

    const request = { Item: lspItem };
    try {
      const response = await this.intellisage(
        'GetCompletionResolveAsync',
        request
      );
      if (!response) {
        return undefined;
      }
      return this._convertToVscodeCompletionItem(response.item);
    } catch (error) {
      console.warn('Error resolve', error);
    }
  }

  async provideSignatureHelp(model, position) {
    const req = this._createRequest(position);
    try {
      const code = model.getValue();
      const res = await this.intellisage('GetSignatureHelpAsync', code, req);

      if (!res) {
        return undefined;
      }

      const ret = {
        signatures     : [],
        activeSignature: res.activeSignature,
        activeParameter: res.activeParameter,
      };

      for (const signature of res.signatures) {
        const signatureInfo = {
          label        : signature.label,
          documentation: signature.structuredDocumentation.summaryText,
          parameters   : [],
        };

        ret.signatures.push(signatureInfo);

        for (const parameter of signature.parameters) {
          const parameterInfo = {
            label        : parameter.label,
            documentation: this._getParameterDocumentation(parameter),
          };

          signatureInfo.parameters.push(parameterInfo);
        }
      }

      return {
        value  : ret,
        dispose: () => {},
      };
    } catch (error) {
      return undefined;
    }
  }

  async provideHover(_document, position) {
    const request = this._createRequest(position);
    try {
      const response = await this.intellisage('GetQuickInfoAsync', request);
      if (!response || !response.markdown) {
        return undefined;
      }

      return {
        contents: [
          {
            value: response.markdown,
          },
        ],
      };
    } catch (error) {
      return undefined;
    }
  }

  setDiagnostics(diagnostics) {
    const model = this.monaco.editor.getModels()[0];
    diagnostics.forEach((diagnostic) => {
      diagnostic.startLineNumber = diagnostic.start.line + 1;
      diagnostic.startColumn = diagnostic.start.character + 1;

      diagnostic.endLineNumber = diagnostic.end.line + 1;
      diagnostic.endColumn = diagnostic.end.character + 1;
    });

    this.monaco.editor.setModelMarkers(model, 'owner', diagnostics);
  }

  _getParameterDocumentation(parameter) {
    const summary = parameter.documentation;
    if (summary.length > 0) {
      const paramText = `**${parameter.name}**: ${summary}`;
      return {
        value: paramText,
      };
    }

    return '';
  }

  _convertToVscodeCompletionItem(omnisharpCompletion) {
    const docs = omnisharpCompletion.documentation;

    const mapRange = function (edit) {
      const newStart = {
        lineNumber: edit.startLine + 1,
        column    : edit.startColumn + 1,
      };
      const newEnd = {
        lineNumber: edit.endLine + 1,
        column    : edit.endColumn + 1,
      };
      return {
        startLineNumber: newStart.lineNumber,
        startColumn    : newStart.column,
        endLineNumber  : newEnd.lineNumber,
        endColumn      : newEnd.column,
      };
    };

    const mapTextEdit = (edit) => {
      return new this.monaco.TextEdit(mapRange(edit), edit.NewText);
    };

    const additionalTextEdits =
      omnisharpCompletion.additionalTextEdits?.map(mapTextEdit);

    const newText =
      omnisharpCompletion.textEdit?.newText ?? omnisharpCompletion.insertText;
    const insertText = newText;

    const insertRange = omnisharpCompletion.textEdit
      ? mapRange(omnisharpCompletion.textEdit)
      : undefined;

    return {
      label        : omnisharpCompletion.label,
      kind         : omnisharpCompletion.kind - 1,
      detail       : omnisharpCompletion.detail,
      documentation: {
        value: docs,
      },
      commitCharacters   : omnisharpCompletion.commitCharacters,
      preselect          : omnisharpCompletion.preselect,
      filterText         : omnisharpCompletion.filterText,
      insertText         : insertText,
      range              : insertRange,
      tags               : omnisharpCompletion.tags,
      sortText           : omnisharpCompletion.sortText,
      additionalTextEdits: additionalTextEdits,
      keepWhitespace     : true,
    };
  }

  _createRequest(position) {
    return {
      Line  : position.lineNumber - 1,
      Column: position.column - 1,
    };
  }
}

function generateId() {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

function debounce(func, delay) {
  let debounceTimer;
  return function (...args) {
    clearTimeout(debounceTimer);
    return new Promise((resolve, reject) => {
      debounceTimer = setTimeout(() => {
        try {
          resolve(func.apply(this, args));
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  };
}