
export const wceLanguage = {
  defaultToken: '',
  tokenPostfix: '.wce',
  
  tokenizer: {
    root: [
      // Comments (match first so keywords inside comments are ignored)
      [/\/\/.*$/, 'comment'],
  
      // Strings (double-quoted)
      [/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
      [/"([^"\\]|\\.)*"/, 'string'],
  
      // Numbers (supports negative numbers)
      [/-?\d+/, 'number'],
  
      // All-caps keywords: any word in all caps (letters, numbers, underscores)
      [/\b[A-Z][A-Z0-9_]*\b/, 'keyword'],
  
      // Whitespace
      [/[ \t\r\n]+/, ''],
  
      // Identifiers: any remaining word
      [/[a-zA-Z_$][\w$]*/, 'identifier'],
    ],
  },
};

export const definitionProvider = monaco => ({
  provideDefinition(model, position) {
    const lineNumber = position.lineNumber;
    const lineContent = model.getLineContent(lineNumber);
    const indentMatch = lineContent.match(/^\s*/);
    const currentIndent = indentMatch ? indentMatch[0].length : 0;

    // If the current line is not indented, there's no parent.
    if (currentIndent === 0) {
      return null;
    }

    // Search backwards for a line with a lower indentation level.
    for (let i = lineNumber - 1; i >= 1; i--) {
      const parentLine = model.getLineContent(i);
      const parentIndentMatch = parentLine.match(/^\s*/);
      const parentIndent = parentIndentMatch ? parentIndentMatch[0].length : 0;
      if (parentIndent < currentIndent) {
        return {
          uri  : model.uri,
          range: new monaco.Range(i, 1, i, parentLine.length + 1),
        };
      }
    }
    return null;
  },
});