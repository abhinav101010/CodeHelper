export interface ThemeDefinition {
  name: string;
  displayName: string;
  colors: {
    bg: string;
    fg: string;
    selection: string;
    lineHighlight: string;
    cursor: string;
    comment: string;
    keyword: string;
    string: string;
    number: string;
    function: string;
    variable: string;
    type: string;
    operator: string;
    bracketPair1: string;
    bracketPair2: string;
    bracketPair3: string;
    indentGuide: string;
    lineNumber: string;
    lineNumberActive: string;
  };
}

export const THEMES: Record<string, ThemeDefinition> = {
  'vscode-dark': {
    name: 'vscode-dark',
    displayName: 'VS Code Dark+',
    colors: {
      bg: '#1e1e1e',
      fg: '#d4d4d4',
      selection: '#264f78',
      lineHighlight: '#2a2d2e',
      cursor: '#aeafad',
      comment: '#6a9955',
      keyword: '#569cd6',
      string: '#ce9178',
      number: '#b5cea8',
      function: '#dcdcaa',
      variable: '#9cdcfe',
      type: '#4ec9b0',
      operator: '#d4d4d4',
      bracketPair1: '#ffd700',
      bracketPair2: '#da70d6',
      bracketPair3: '#87ceeb',
      indentGuide: '#404040',
      lineNumber: '#858585',
      lineNumberActive: '#c6c6c6',
    },
  },
  'github-dark': {
    name: 'github-dark',
    displayName: 'GitHub Dark',
    colors: {
      bg: '#0d1117',
      fg: '#c9d1d9',
      selection: '#1f6feb44',
      lineHighlight: '#161b22',
      cursor: '#c9d1d9',
      comment: '#8b949e',
      keyword: '#ff7b72',
      string: '#a5d6ff',
      number: '#79c0ff',
      function: '#d2a8ff',
      variable: '#ffa657',
      type: '#7ee787',
      operator: '#c9d1d9',
      bracketPair1: '#ffa657',
      bracketPair2: '#79c0ff',
      bracketPair3: '#7ee787',
      indentGuide: '#21262d',
      lineNumber: '#484f58',
      lineNumberActive: '#c9d1d9',
    },
  },
  monokai: {
    name: 'monokai',
    displayName: 'Monokai',
    colors: {
      bg: '#272822',
      fg: '#f8f8f2',
      selection: '#49483e',
      lineHighlight: '#3e3d32',
      cursor: '#f8f8f0',
      comment: '#75715e',
      keyword: '#f92672',
      string: '#e6db74',
      number: '#ae81ff',
      function: '#a6e22e',
      variable: '#f8f8f2',
      type: '#66d9ef',
      operator: '#f92672',
      bracketPair1: '#f8f8f2',
      bracketPair2: '#ae81ff',
      bracketPair3: '#a6e22e',
      indentGuide: '#3e3d32',
      lineNumber: '#90908a',
      lineNumberActive: '#f8f8f2',
    },
  },
  'one-dark': {
    name: 'one-dark',
    displayName: 'One Dark',
    colors: {
      bg: '#282c34',
      fg: '#abb2bf',
      selection: '#3e4451',
      lineHighlight: '#2c313c',
      cursor: '#528bff',
      comment: '#5c6370',
      keyword: '#c678dd',
      string: '#98c379',
      number: '#d19a66',
      function: '#61afef',
      variable: '#e06c75',
      type: '#e5c07b',
      operator: '#56b6c2',
      bracketPair1: '#e06c75',
      bracketPair2: '#c678dd',
      bracketPair3: '#61afef',
      indentGuide: '#3b4048',
      lineNumber: '#4b5263',
      lineNumberActive: '#abb2bf',
    },
  },
  dracula: {
    name: 'dracula',
    displayName: 'Dracula',
    colors: {
      bg: '#282a36',
      fg: '#f8f8f2',
      selection: '#44475a',
      lineHighlight: '#44475a',
      cursor: '#f8f8f2',
      comment: '#6272a4',
      keyword: '#ff79c6',
      string: '#f1fa8c',
      number: '#bd93f9',
      function: '#50fa7b',
      variable: '#f8f8f2',
      type: '#8be9fd',
      operator: '#ff79c6',
      bracketPair1: '#ff79c6',
      bracketPair2: '#bd93f9',
      bracketPair3: '#50fa7b',
      indentGuide: '#44475a',
      lineNumber: '#6272a4',
      lineNumberActive: '#f8f8f2',
    },
  },
  'solarized-dark': {
    name: 'solarized-dark',
    displayName: 'Solarized Dark',
    colors: {
      bg: '#002b36',
      fg: '#839496',
      selection: '#073642',
      lineHighlight: '#073642',
      cursor: '#839496',
      comment: '#586e75',
      keyword: '#859900',
      string: '#2aa198',
      number: '#d33682',
      function: '#268bd2',
      variable: '#b58900',
      type: '#cb4b16',
      operator: '#859900',
      bracketPair1: '#b58900',
      bracketPair2: '#268bd2',
      bracketPair3: '#2aa198',
      indentGuide: '#073642',
      lineNumber: '#586e75',
      lineNumberActive: '#839496',
    },
  },
};
