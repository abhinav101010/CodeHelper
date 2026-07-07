import type { Snippet } from '../../types/snippet';

export const BUILTIN_SNIPPETS: Snippet[] = [
  // Python snippets
  {
    prefix: ['for', 'fori'],
    body: 'for ${1:i} in range(${2:n}):\n\t${0:pass}',
    description: 'For loop',
    language: ['python', 'python3'],
  },
  {
    prefix: ['forr', 'fore'],
    body: 'for ${1:item} in ${2:iterable}:\n\t${0:pass}',
    description: 'For-each loop',
    language: ['python', 'python3'],
  },
  {
    prefix: ['while'],
    body: 'while ${1:condition}:\n\t${0:pass}',
    description: 'While loop',
    language: ['python', 'python3'],
  },
  {
    prefix: ['if'],
    body: 'if ${1:condition}:\n\t${0:pass}',
    description: 'If statement',
    language: ['python', 'python3'],
  },
  {
    prefix: ['elif'],
    body: 'elif ${1:condition}:\n\t${0:pass}',
    description: 'Elif statement',
    language: ['python', 'python3'],
  },
  {
    prefix: ['else'],
    body: 'else:\n\t${0:pass}',
    description: 'Else statement',
    language: ['python', 'python3'],
  },
  {
    prefix: ['def'],
    body: 'def ${1:function_name}(${2:args}):\n\t${0:pass}',
    description: 'Function definition',
    language: ['python', 'python3'],
  },
  {
    prefix: ['class'],
    body: 'class ${1:ClassName}:\n\tdef __init__(self${2:, args}):\n\t\t${0:pass}',
    description: 'Class definition',
    language: ['python', 'python3'],
  },
  {
    prefix: ['try'],
    body: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:pass}',
    description: 'Try-except block',
    language: ['python', 'python3'],
  },
  {
    prefix: ['readline'],
    body: '${1:line} = input().strip().split()',
    description: 'Read line as list',
    language: ['python', 'python3'],
  },
  {
    prefix: ['si'],
    body: 'import sys\ninput = sys.stdin.readline',
    description: 'Fast input (Python)',
    language: ['python', 'python3'],
  },
  {
    prefix: ['arr'],
    body: '${1:arr} = list(map(int, input().split()))',
    description: 'Read array of integers',
    language: ['python', 'python3'],
  },
  {
    prefix: ['ints'],
    body: 'list(map(int, input().split()))',
    description: 'Read integers',
    language: ['python', 'python3'],
  },
  {
    prefix: ['read2'],
    body: '${1:a}, ${2:b} = map(int, input().split())',
    description: 'Read 2 integers',
    language: ['python', 'python3'],
  },
  {
    prefix: ['read3'],
    body: '${1:a}, ${2:b}, ${3:c} = map(int, input().split())',
    description: 'Read 3 integers',
    language: ['python', 'python3'],
  },
  {
    prefix: ['graph'],
    body: '${1:graph} = [[] for _ in range(${2:n})]',
    description: 'Adjacency list graph',
    language: ['python', 'python3'],
  },
  {
    prefix: ['matrix'],
    body: '${1:matrix} = [[0] * ${2:m} for _ in range(${3:n})]',
    description: 'Matrix initialization',
    language: ['python', 'python3'],
  },
  {
    prefix: ['freq'],
    body: '${1:freq} = {}',
    description: 'Frequency dictionary',
    language: ['python', 'python3'],
  },
  {
    prefix: ['deque'],
    body: 'from collections import deque',
    description: 'Import deque',
    language: ['python', 'python3'],
  },
  {
    prefix: ['heap'],
    body: 'import heapq',
    description: 'Import heapq',
    language: ['python', 'python3'],
  },
  {
    prefix: ['bisect'],
    body: 'import bisect',
    description: 'Import bisect',
    language: ['python', 'python3'],
  },

  // C++ snippets
  {
    prefix: ['for', 'fori'],
    body: 'for (int ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop (C++)',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['forr', 'fore'],
    body: 'for (const auto& ${1:elem} : ${2:container}) {\n\t${0}\n}',
    description: 'Range-based for loop (C++)',
    language: ['cpp'],
  },
  {
    prefix: ['while'],
    body: 'while (${1:condition}) {\n\t${0}\n}',
    description: 'While loop (C++)',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['if'],
    body: 'if (${1:condition}) {\n\t${0}\n}',
    description: 'If statement (C++)',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['else'],
    body: '} else {\n\t${0}\n}',
    description: 'Else statement (C++)',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['vf'],
    body: 'vector<${1:int}> ${2:v}(${3:n});',
    description: 'Vector declaration',
    language: ['cpp'],
  },
  {
    prefix: ['pb'],
    body: '${1:v}.push_back(${2:value});',
    description: 'push_back',
    language: ['cpp'],
  },
  {
    prefix: ['gcd'],
    body: '__gcd(${1:a}, ${2:b})',
    description: 'GCD',
    language: ['cpp'],
  },
  {
    prefix: ['ios'],
    body: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);',
    description: 'Fast I/O',
    language: ['cpp'],
  },
  {
    prefix: ['sort'],
    body: 'sort(${1:v}.begin(), $1.end());',
    description: 'Sort vector',
    language: ['cpp'],
  },
  {
    prefix: ['mp'],
    body: 'map<${1:int}, ${2:int}> ${3:m};',
    description: 'Map declaration',
    language: ['cpp'],
  },
  {
    prefix: ['st'],
    body: 'set<${1:int}> ${2:s};',
    description: 'Set declaration',
    language: ['cpp'],
  },
  {
    prefix: ['pp'],
    body: 'pair<${1:int}, ${2:int}> ${3:p};',
    description: 'Pair declaration',
    language: ['cpp'],
  },

  // Java snippets
  {
    prefix: ['for', 'fori'],
    body: 'for (int ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop (Java)',
    language: ['java'],
  },
  {
    prefix: ['foreach'],
    body: 'for (${1:int} ${2:item} : ${3:array}) {\n\t${0}\n}',
    description: 'For-each loop (Java)',
    language: ['java'],
  },
  {
    prefix: ['while'],
    body: 'while (${1:condition}) {\n\t${0}\n}',
    description: 'While loop (Java)',
    language: ['java'],
  },
  {
    prefix: ['if'],
    body: 'if (${1:condition}) {\n\t${0}\n}',
    description: 'If statement (Java)',
    language: ['java'],
  },
  {
    prefix: ['class'],
    body: 'public class ${1:ClassName} {\n\t${0}\n}',
    description: 'Class definition (Java)',
    language: ['java'],
  },
  {
    prefix: ['scanner'],
    body: 'Scanner sc = new Scanner(System.in);',
    description: 'Scanner initialization',
    language: ['java'],
  },

  // JavaScript snippets
  {
    prefix: ['for', 'fori'],
    body: 'for (let ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop (JS)',
    language: ['javascript', 'js'],
  },
  {
    prefix: ['foreach'],
    body: '${1:array}.forEach((${2:item}) => {\n\t${0}\n});',
    description: 'ForEach loop (JS)',
    language: ['javascript', 'js'],
  },
  {
    prefix: ['map'],
    body: '${1:array}.map((${2:item}) => ${3:item})',
    description: 'Map function (JS)',
    language: ['javascript', 'js'],
  },
  {
    prefix: ['filter'],
    body: '${1:array}.filter((${2:item}) => ${3:item})',
    description: 'Filter function (JS)',
    language: ['javascript', 'js'],
  },
  {
    prefix: ['const'],
    body: 'const ${1:name} = ${2:value};',
    description: 'Const declaration (JS)',
    language: ['javascript', 'js'],
  },
  {
    prefix: ['let'],
    body: 'let ${1:name} = ${2:value};',
    description: 'Let declaration (JS)',
    language: ['javascript', 'js'],
  },
];
