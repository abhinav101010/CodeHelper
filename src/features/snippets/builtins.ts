import type { Snippet } from '../../types/snippet';

export const BUILTIN_SNIPPETS: Snippet[] = [
  // ═══════════════════════════════════════════════════════════════
  // PYTHON SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  // ── Loops & Conditionals ──────────────────────────────────────
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

  // ── Functions & Classes ──────────────────────────────────────
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

  // ── Error Handling ──────────────────────────────────────────
  {
    prefix: ['try'],
    body: 'try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${0:pass}',
    description: 'Try-except block',
    language: ['python', 'python3'],
  },

  // ── I/O ──────────────────────────────────────────────────────
  {
    prefix: ['si'],
    body: 'import sys\ninput = sys.stdin.readline',
    description: 'Fast input',
    language: ['python', 'python3'],
  },
  {
    prefix: ['rint'],
    body: 'int(input())',
    description: 'Read integer',
    language: ['python', 'python3'],
  },
  {
    prefix: ['readline'],
    body: '${1:line} = input().strip().split()',
    description: 'Read line as list',
    language: ['python', 'python3'],
  },
  {
    prefix: ['ints'],
    body: 'list(map(int, input().split()))',
    description: 'Read integer list',
    language: ['python', 'python3'],
  },
  {
    prefix: ['arr'],
    body: '${1:arr} = list(map(int, input().split()))',
    description: 'Read array of integers',
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
    prefix: ['readn'],
    body: '${1:n} = int(input())\n${2:arr} = list(map(int, input().split()))',
    description: 'Read n and array',
    language: ['python', 'python3'],
  },
  {
    prefix: ['readgrid'],
    body: '${1:grid} = [list(map(int, input().split())) for _ in range(${2:n})]',
    description: 'Read 2D grid',
    language: ['python', 'python3'],
  },
  {
    prefix: ['printarr'],
    body: "print(' '.join(map(str, ${1:arr})))",
    description: 'Print array with spaces',
    language: ['python', 'python3'],
  },

  // ── Data Structures ──────────────────────────────────────────
  {
    prefix: ['graph'],
    body: '${1:graph} = [[] for _ in range(${2:n})]',
    description: 'Adjacency list',
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
    description: 'Frequency dict',
    language: ['python', 'python3'],
  },
  {
    prefix: ['defaultdict'],
    body: 'from collections import defaultdict\n${1:d} = defaultdict(${2:int})',
    description: 'DefaultDict',
    language: ['python', 'python3'],
  },
  {
    prefix: ['counter'],
    body: 'from collections import Counter\n${1:c} = Counter(${2:items})',
    description: 'Counter',
    language: ['python', 'python3'],
  },
  {
    prefix: ['deque'],
    body: 'from collections import deque',
    description: 'Import deque',
    language: ['python', 'python3'],
  },
  {
    prefix: ['dq'],
    body: 'from collections import deque\n${1:dq} = deque(${2:items})',
    description: 'Initialize deque',
    language: ['python', 'python3'],
  },
  {
    prefix: ['heap'],
    body: 'import heapq',
    description: 'Import heapq',
    language: ['python', 'python3'],
  },
  {
    prefix: ['heapq'],
    body: 'import heapq\nheapq.heapify(${1:arr})\nheapq.heappush(${1:arr}, ${2:val})\n${3:min_val} = heapq.heappop(${1:arr})',
    description: 'Heap operations',
    language: ['python', 'python3'],
  },
  {
    prefix: ['bisect'],
    body: 'import bisect',
    description: 'Import bisect',
    language: ['python', 'python3'],
  },
  {
    prefix: ['bisect_left'],
    body: 'bisect.bisect_left(${1:arr}, ${2:x})',
    description: 'Bisect left',
    language: ['python', 'python3'],
  },
  {
    prefix: ['sortedlist'],
    body: 'from sortedcontainers import SortedList\n${1:sl} = SortedList()',
    description: 'SortedList',
    language: ['python', 'python3'],
  },
  {
    prefix: ['lru'],
    body: 'from functools import lru_cache\n@lru_cache(maxsize=None)\ndef ${1:dp}(${2:args}):\n\t${0:pass}',
    description: 'LRU cache decorator',
    language: ['python', 'python3'],
  },

  // ── Algorithms ───────────────────────────────────────────────
  {
    prefix: ['bfs'],
    body: 'from collections import deque\n\ndef bfs(${1:start}):\n\tq = deque([$1])\n\tvisited = set([$1])\n\twhile q:\n\t\tnode = q.popleft()\n\t\tfor nei in ${2:graph}[node]:\n\t\t\tif nei not in visited:\n\t\t\t\tvisited.add(nei)\n\t\t\t\tq.append(nei)',
    description: 'BFS template',
    language: ['python', 'python3'],
  },
  {
    prefix: ['dfs'],
    body: 'def dfs(${1:node}):\n\tvisited.add($1)\n\tfor nei in ${2:graph}[$1]:\n\t\tif nei not in visited:\n\t\t\tdfs(nei)',
    description: 'DFS recursive',
    language: ['python', 'python3'],
  },
  {
    prefix: ['dijkstra'],
    body: "import heapq\n\ndef dijkstra(${1:start}, ${2:n}):\n\tdist = [float('inf')] * $2\n\tdist[$1] = 0\n\tpq = [(0, $1)]\n\twhile pq:\n\t\td, u = heapq.heappop(pq)\n\t\tif d > dist[u]: continue\n\t\tfor v, w in ${3:graph}[u]:\n\t\t\tif dist[u] + w < dist[v]:\n\t\t\t\tdist[v] = dist[u] + w\n\t\t\t\theapq.heappush(pq, (dist[v], v))\n\treturn dist",
    description: 'Dijkstra',
    language: ['python', 'python3'],
  },
  {
    prefix: ['binarysearch'],
    body: 'def binary_search(${1:arr}, ${2:target}):\n\tlo, hi = 0, len($1) - 1\n\twhile lo <= hi:\n\t\tmid = (lo + hi) // 2\n\t\tif $1[mid] == $2:\n\t\t\treturn mid\n\t\telif $1[mid] < $2:\n\t\t\tlo = mid + 1\n\t\telse:\n\t\t\thi = mid - 1\n\treturn -1',
    description: 'Binary search',
    language: ['python', 'python3'],
  },
  {
    prefix: ['sieve'],
    body: 'def sieve(${1:n}):\n\tprime = [True] * ($1 + 1)\n\tprime[0] = prime[1] = False\n\tfor i in range(2, int($1**0.5) + 1):\n\t\tif prime[i]:\n\t\t\tfor j in range(i*i, $1 + 1, i):\n\t\t\t\tprime[j] = False\n\treturn [i for i in range($1 + 1) if prime[i]]',
    description: 'Sieve of Eratosthenes',
    language: ['python', 'python3'],
  },
  {
    prefix: ['lcs'],
    body: 'def lcs(${1:s1}, ${2:s2}):\n\tm, n = len($1), len($2)\n\tdp = [[0] * (n + 1) for _ in range(m + 1)]\n\tfor i in range(1, m + 1):\n\t\tfor j in range(1, n + 1):\n\t\t\tif $1[i-1] == $2[j-1]:\n\t\t\t\tdp[i][j] = dp[i-1][j-1] + 1\n\t\t\telse:\n\t\t\t\tdp[i][j] = max(dp[i-1][j], dp[i][j-1])\n\treturn dp[m][n]',
    description: 'Longest Common Subsequence',
    language: ['python', 'python3'],
  },
  {
    prefix: ['knap'],
    body: 'def knapsack(${1:weights}, ${2:values}, ${3:capacity}):\n\tn = len($1)\n\tdp = [0] * ($3 + 1)\n\tfor i in range(n):\n\t\tfor w in range($3, $1[i] - 1, -1):\n\t\t\tdp[w] = max(dp[w], dp[w - $1[i]] + $2[i])\n\treturn dp[$3]',
    description: '0/1 Knapsack',
    language: ['python', 'python3'],
  },
  {
    prefix: ['lis'],
    body: 'def lis(${1:arr}):\n\tfrom bisect import bisect_left\n\ttails = []\n\tfor x in $1:\n\t\ti = bisect_left(tails, x)\n\t\tif i == len(tails):\n\t\t\ttails.append(x)\n\t\telse:\n\t\t\ttails[i] = x\n\treturn len(tails)',
    description: 'Longest Increasing Subsequence',
    language: ['python', 'python3'],
  },
  {
    prefix: ['mod'],
    body: 'MOD = 10**9 + 7',
    description: 'MOD constant',
    language: ['python', 'python3'],
  },
  {
    prefix: ['modmul'],
    body: 'pow(${1:x}, ${2:n}, MOD)',
    description: 'Modular exponentiation',
    language: ['python', 'python3'],
  },

  // ═══════════════════════════════════════════════════════════════
  // C++ SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  // ── Loops & Conditionals ──────────────────────────────────────
  {
    prefix: ['for', 'fori'],
    body: 'for (int ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['forr', 'fore'],
    body: 'for (const auto& ${1:elem} : ${2:container}) {\n\t${0}\n}',
    description: 'Range-based for loop',
    language: ['cpp'],
  },
  {
    prefix: ['while'],
    body: 'while (${1:condition}) {\n\t${0}\n}',
    description: 'While loop',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['if'],
    body: 'if (${1:condition}) {\n\t${0}\n}',
    description: 'If statement',
    language: ['cpp', 'c'],
  },
  {
    prefix: ['else'],
    body: '} else {\n\t${0}\n}',
    description: 'Else statement',
    language: ['cpp', 'c'],
  },

  // ── I/O & Fast I/O ──────────────────────────────────────────
  {
    prefix: ['ios'],
    body: 'ios_base::sync_with_stdio(false);\ncin.tie(NULL);',
    description: 'Fast I/O',
    language: ['cpp'],
  },
  {
    prefix: ['cin'],
    body: 'cin >> ${1:var};',
    description: 'Cin input',
    language: ['cpp'],
  },
  {
    prefix: ['cout'],
    body: 'cout << ${1:var} << endl;',
    description: 'Cout output',
    language: ['cpp'],
  },

  // ── STL Containers ──────────────────────────────────────────
  {
    prefix: ['vf'],
    body: 'vector<${1:int}> ${2:v}(${3:n});',
    description: 'Vector declaration',
    language: ['cpp'],
  },
  {
    prefix: ['vvi'],
    body: 'vector<vector<${1:int}>> ${2:matrix}(${3:n}, vector<${1:int}>(${4:m}));',
    description: '2D vector',
    language: ['cpp'],
  },
  {
    prefix: ['pb'],
    body: '${1:v}.push_back(${2:value});',
    description: 'push_back',
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
  {
    prefix: ['pq'],
    body: 'priority_queue<${1:int}> ${2:pq};',
    description: 'Max-heap (priority queue)',
    language: ['cpp'],
  },
  {
    prefix: ['pqmin'],
    body: 'priority_queue<${1:int}, vector<${1:int}>, greater<${1:int}>> ${2:pq};',
    description: 'Min-heap',
    language: ['cpp'],
  },
  {
    prefix: ['us'],
    body: 'unordered_set<${1:int}> ${2:s};',
    description: 'Unordered set',
    language: ['cpp'],
  },
  {
    prefix: ['um'],
    body: 'unordered_map<${1:int}, ${2:int}> ${3:m};',
    description: 'Unordered map',
    language: ['cpp'],
  },
  {
    prefix: ['stack'],
    body: 'stack<${1:int}> ${2:st};',
    description: 'Stack declaration',
    language: ['cpp'],
  },
  {
    prefix: ['queue'],
    body: 'queue<${1:int}> ${2:q};',
    description: 'Queue declaration',
    language: ['cpp'],
  },
  {
    prefix: ['dq'],
    body: 'deque<${1:int}> ${2:dq};',
    description: 'Deque declaration',
    language: ['cpp'],
  },

  // ── Algorithms ───────────────────────────────────────────────
  {
    prefix: ['sort'],
    body: 'sort(${1:v}.begin(), $1.end());',
    description: 'Sort vector',
    language: ['cpp'],
  },
  {
    prefix: ['sortdesc'],
    body: 'sort(${1:v}.rbegin(), $1.rend());',
    description: 'Sort descending',
    language: ['cpp'],
  },
  {
    prefix: ['accumulate'],
    body: 'accumulate(${1:v}.begin(), $1.end(), 0${2:, [](int a, int b) { return a + b; }});',
    description: 'Accumulate / sum',
    language: ['cpp'],
  },
  {
    prefix: ['gcd'],
    body: '__gcd(${1:a}, ${2:b})',
    description: 'GCD',
    language: ['cpp'],
  },
  {
    prefix: ['lcm'],
    body: '(${1:a} / __gcd($1, ${2:b}) * $2)',
    description: 'LCM',
    language: ['cpp'],
  },
  {
    prefix: ['bs'],
    body: 'binary_search(${1:v}.begin(), $1.end(), ${2:value})',
    description: 'Binary search (bool)',
    language: ['cpp'],
  },
  {
    prefix: ['lower'],
    body: 'lower_bound(${1:v}.begin(), $1.end(), ${2:value})',
    description: 'Lower bound',
    language: ['cpp'],
  },
  {
    prefix: ['upper'],
    body: 'upper_bound(${1:v}.begin(), $1.end(), ${2:value})',
    description: 'Upper bound',
    language: ['cpp'],
  },
  {
    prefix: ['rev'],
    body: 'reverse(${1:v}.begin(), $1.end());',
    description: 'Reverse vector',
    language: ['cpp'],
  },
  {
    prefix: ['fill'],
    body: 'fill(${1:v}.begin(), $1.end(), ${2:value});',
    description: 'Fill vector',
    language: ['cpp'],
  },
  {
    prefix: ['maxel'],
    body: '*max_element(${1:v}.begin(), $1.end())',
    description: 'Max element',
    language: ['cpp'],
  },
  {
    prefix: ['minel'],
    body: '*min_element(${1:v}.begin(), $1.end())',
    description: 'Min element',
    language: ['cpp'],
  },

  // ── Competitive Programming Templates ─────────────────────────
  {
    prefix: ['bfs'],
    body: 'queue<${1:int}> q;\nq.push(${2:start});\nvector<bool> visited(${3:n}, false);\nvisited[$2] = true;\nwhile (!q.empty()) {\n\tint u = q.front(); q.pop();\n\tfor (int v : ${4:adj}[u]) {\n\t\tif (!visited[v]) {\n\t\t\tvisited[v] = true;\n\t\t\tq.push(v);\n\t\t}\n\t}\n}',
    description: 'BFS template',
    language: ['cpp'],
  },
  {
    prefix: ['dfs'],
    body: 'function<void(int)> dfs = [&](int u) {\n\tvisited[u] = true;\n\tfor (int v : ${1:adj}[u]) {\n\t\tif (!visited[v]) dfs(v);\n\t}\n};\nvector<bool> visited(${2:n}, false);\ndfs(${3:start});',
    description: 'DFS template',
    language: ['cpp'],
  },
  {
    prefix: ['dijkstra'],
    body: 'vector<int> dist(${1:n}, INT_MAX);\ndist[${2:src}] = 0;\npriority_queue<pair<int,int>, vector<pair<int,int>>, greater<pair<int,int>>> pq;\npq.push({0, $2});\nwhile (!pq.empty()) {\n\tauto [d, u] = pq.top(); pq.pop();\n\tif (d > dist[u]) continue;\n\tfor (auto [v, w] : ${3:adj}[u]) {\n\t\tif (dist[u] + w < dist[v]) {\n\t\t\tdist[v] = dist[u] + w;\n\t\t\tpq.push({dist[v], v});\n\t\t}\n\t}\n}',
    description: 'Dijkstra template',
    language: ['cpp'],
  },
  {
    prefix: ['dsu'],
    body: 'struct DSU {\n\tvector<int> parent, size;\n\tDSU(int n) : parent(n), size(n, 1) {\n\t\tiota(parent.begin(), parent.end(), 0);\n\t}\n\tint find(int x) {\n\t\twhile (parent[x] != x) {\n\t\t\tparent[x] = parent[parent[x]];\n\t\t\tx = parent[x];\n\t\t}\n\t\treturn x;\n\t}\n\tvoid unite(int a, int b) {\n\t\ta = find(a), b = find(b);\n\t\tif (a == b) return;\n\t\tif (size[a] < size[b]) swap(a, b);\n\t\tparent[b] = a;\n\t\tsize[a] += size[b];\n\t}\n};',
    description: 'DSU (Union-Find)',
    language: ['cpp'],
  },
  {
    prefix: ['seg'],
    body: 'struct SegTree {\n\tvector<int> tree;\n\tint n;\n\tSegTree(int _n) : n(_n), tree(4 * _n) {}\n\tvoid update(int idx, int val, int node = 1, int l = 0, int r = -1) {\n\t\tif (r == -1) r = n - 1;\n\t\tif (l == r) { tree[node] = val; return; }\n\t\tint mid = (l + r) / 2;\n\t\tif (idx <= mid) update(idx, val, node*2, l, mid);\n\t\telse update(idx, val, node*2+1, mid+1, r);\n\t\ttree[node] = tree[node*2] + tree[node*2+1];\n\t}\n\tint query(int ql, int qr, int node = 1, int l = 0, int r = -1) {\n\t\tif (r == -1) r = n - 1;\n\t\tif (ql > r || qr < l) return 0;\n\t\tif (ql <= l && r <= qr) return tree[node];\n\t\tint mid = (l + r) / 2;\n\t\treturn query(ql, qr, node*2, l, mid) + query(ql, qr, node*2+1, mid+1, r);\n\t}\n};',
    description: 'Segment Tree',
    language: ['cpp'],
  },
  {
    prefix: ['fenwick'],
    body: 'struct BIT {\n\tvector<int> bit;\n\tint n;\n\tBIT(int _n) : n(_n), bit(_n + 1) {}\n\tvoid add(int idx, int val) {\n\t\tfor (++idx; idx <= n; idx += idx & -idx) bit[idx] += val;\n\t}\n\tint sum(int idx) {\n\t\tint res = 0;\n\t\tfor (++idx; idx > 0; idx -= idx & -idx) res += bit[idx];\n\t\treturn res;\n\t}\n\tint range(int l, int r) { return sum(r) - sum(l - 1); }\n};',
    description: 'Fenwick Tree (BIT)',
    language: ['cpp'],
  },
  {
    prefix: ['sieve'],
    body: 'vector<bool> is_prime(${1:n} + 1, true);\nis_prime[0] = is_prime[1] = false;\nfor (int i = 2; i * i <= $1; i++) {\n\tif (is_prime[i]) {\n\t\tfor (int j = i * i; j <= $1; j += i)\n\t\t\tis_prime[j] = false;\n\t}\n}',
    description: 'Sieve of Eratosthenes',
    language: ['cpp'],
  },
  {
    prefix: ['powmod'],
    body: 'long long modpow(long long base, long long exp, long long mod) {\n\tlong long res = 1;\n\twhile (exp > 0) {\n\t\tif (exp & 1) res = (res * base) % mod;\n\t\tbase = (base * base) % mod;\n\t\texp >>= 1;\n\t}\n\treturn res;\n}',
    description: 'Modular exponentiation',
    language: ['cpp'],
  },
  {
    prefix: ['kmp'],
    body: 'vector<int> build_lps(const string &pat) {\n\tint m = pat.size();\n\tvector<int> lps(m);\n\tfor (int i = 1, len = 0; i < m; ) {\n\t\tif (pat[i] == pat[len]) {\n\t\t\tlps[i++] = ++len;\n\t\t} else if (len) {\n\t\t\tlen = lps[len - 1];\n\t\t} else {\n\t\t\tlps[i++] = 0;\n\t\t}\n\t}\n\treturn lps;\n}',
    description: 'KMP LPS array',
    language: ['cpp'],
  },

  // ═══════════════════════════════════════════════════════════════
  // JAVA SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  // ── Loops & Conditionals ──────────────────────────────────────
  {
    prefix: ['for', 'fori'],
    body: 'for (int ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop',
    language: ['java'],
  },
  {
    prefix: ['foreach'],
    body: 'for (${1:int} ${2:item} : ${3:array}) {\n\t${0}\n}',
    description: 'For-each loop',
    language: ['java'],
  },
  {
    prefix: ['while'],
    body: 'while (${1:condition}) {\n\t${0}\n}',
    description: 'While loop',
    language: ['java'],
  },
  {
    prefix: ['if'],
    body: 'if (${1:condition}) {\n\t${0}\n}',
    description: 'If statement',
    language: ['java'],
  },

  // ── Classes & Methods ────────────────────────────────────────
  {
    prefix: ['class'],
    body: 'public class ${1:ClassName} {\n\t${0}\n}',
    description: 'Class definition',
    language: ['java'],
  },
  {
    prefix: ['main'],
    body: 'public static void main(String[] args) {\n\t${0}\n}',
    description: 'Main method',
    language: ['java'],
  },
  {
    prefix: ['psvm'],
    body: 'public static void main(String[] args) {\n\t${0}\n}',
    description: 'PSVM shortcut',
    language: ['java'],
  },
  {
    prefix: ['sout'],
    body: 'System.out.println(${1:var});',
    description: 'System.out.println',
    language: ['java'],
  },
  {
    prefix: ['soutf'],
    body: 'System.out.printf("${1:%s}", ${2:var});',
    description: 'System.out.printf',
    language: ['java'],
  },

  // ── I/O ──────────────────────────────────────────────────────
  {
    prefix: ['scanner'],
    body: 'Scanner sc = new Scanner(System.in);',
    description: 'Scanner initialization',
    language: ['java'],
  },
  {
    prefix: ['scint'],
    body: 'sc.nextInt()',
    description: 'Scanner read int',
    language: ['java'],
  },
  {
    prefix: ['scstr'],
    body: 'sc.next()',
    description: 'Scanner read string',
    language: ['java'],
  },
  {
    prefix: ['br'],
    body: 'BufferedReader br = new BufferedReader(new InputStreamReader(System.in));',
    description: 'BufferedReader',
    language: ['java'],
  },
  {
    prefix: ['stk'],
    body: 'StringTokenizer st = new StringTokenizer(br.readLine());',
    description: 'StringTokenizer',
    language: ['java'],
  },

  // ── Data Structures ──────────────────────────────────────────
  {
    prefix: ['al'],
    body: 'List<${1:Integer}> ${2:list} = new ArrayList<>();',
    description: 'ArrayList',
    language: ['java'],
  },
  {
    prefix: ['hm'],
    body: 'Map<${1:Integer}, ${2:Integer}> ${3:map} = new HashMap<>();',
    description: 'HashMap',
    language: ['java'],
  },
  {
    prefix: ['hs'],
    body: 'Set<${1:Integer}> ${2:set} = new HashSet<>();',
    description: 'HashSet',
    language: ['java'],
  },
  {
    prefix: ['ts'],
    body: 'TreeSet<${1:Integer}> ${2:ts} = new TreeSet<>();',
    description: 'TreeSet',
    language: ['java'],
  },
  {
    prefix: ['tm'],
    body: 'TreeMap<${1:Integer}, ${2:Integer}> ${3:tm} = new TreeMap<>();',
    description: 'TreeMap',
    language: ['java'],
  },
  {
    prefix: ['pq'],
    body: 'PriorityQueue<${1:Integer}> ${2:pq} = new PriorityQueue<>();',
    description: 'Min-heap (PriorityQueue)',
    language: ['java'],
  },
  {
    prefix: ['pqmax'],
    body: 'PriorityQueue<${1:Integer}> ${2:pq} = new PriorityQueue<>(Collections.reverseOrder());',
    description: 'Max-heap',
    language: ['java'],
  },
  {
    prefix: ['dq'],
    body: 'Deque<${1:Integer}> ${2:dq} = new ArrayDeque<>();',
    description: 'ArrayDeque',
    language: ['java'],
  },
  {
    prefix: ['stack'],
    body: 'Stack<${1:Integer}> ${2:st} = new Stack<>();',
    description: 'Stack',
    language: ['java'],
  },
  {
    prefix: ['arr2d'],
    body: 'int[][] ${1:matrix} = new int[${2:n}][${3:m}];',
    description: '2D array',
    language: ['java'],
  },

  // ── Algorithms ───────────────────────────────────────────────
  {
    prefix: ['sort'],
    body: 'Arrays.sort(${1:arr});',
    description: 'Sort array',
    language: ['java'],
  },
  {
    prefix: ['sortl'],
    body: 'Collections.sort(${1:list});',
    description: 'Sort list',
    language: ['java'],
  },
  {
    prefix: ['copyl'],
    body: 'new ArrayList<>(${1:original})',
    description: 'Copy list',
    language: ['java'],
  },
  {
    prefix: ['tma'],
    body: '${1:arr}.length',
    description: 'Array length',
    language: ['java'],
  },

  // ═══════════════════════════════════════════════════════════════
  // JAVASCRIPT / TYPESCRIPT SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  {
    prefix: ['for', 'fori'],
    body: 'for (let ${1:i} = 0; $1 < ${2:n}; $1++) {\n\t${0}\n}',
    description: 'For loop',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['foreach'],
    body: '${1:array}.forEach((${2:item}) => {\n\t${0}\n});',
    description: 'ForEach loop',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['forof'],
    body: 'for (const ${1:item} of ${2:iterable}) {\n\t${0}\n}',
    description: 'For...of loop',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['forin'],
    body: 'for (const ${1:key} in ${2:obj}) {\n\t${0}\n}',
    description: 'For...in loop',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['while'],
    body: 'while (${1:condition}) {\n\t${0}\n}',
    description: 'While loop',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['if'],
    body: 'if (${1:condition}) {\n\t${0}\n}',
    description: 'If statement',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['const'],
    body: 'const ${1:name} = ${2:value};',
    description: 'Const declaration',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['let'],
    body: 'let ${1:name} = ${2:value};',
    description: 'Let declaration',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['map'],
    body: '${1:array}.map((${2:item}) => ${3:item})',
    description: 'Array.map',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['filter'],
    body: '${1:array}.filter((${2:item}) => ${3:item})',
    description: 'Array.filter',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['reduce'],
    body: '${1:array}.reduce((${2:acc}, ${3:val}) => $2 + $3, 0)',
    description: 'Array.reduce',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['sortf'],
    body: '${1:array}.sort((${2:a}, ${3:b}) => $2 - $3)',
    description: 'Sort with compare fn',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['pq'],
    body: 'class PriorityQueue {\n\tconstructor(cmp = (a, b) => a - b) {\n\t\tthis.heap = [];\n\t\tthis.cmp = cmp;\n\t}\n\tpush(v) {\n\t\tthis.heap.push(v);\n\t\tthis._bubbleUp(this.heap.length - 1);\n\t}\n\tpop() {\n\t\tif (this.heap.length === 1) return this.heap.pop();\n\t\tconst top = this.heap[0];\n\t\tthis.heap[0] = this.heap.pop();\n\t\tthis._sinkDown(0);\n\t\treturn top;\n\t}\n\tget size() { return this.heap.length; }\n\t_bubbleUp(i) {\n\t\twhile (i) {\n\t\t\tconst p = (i - 1) >> 1;\n\t\t\tif (this.cmp(this.heap[i], this.heap[p]) >= 0) break;\n\t\t\t[this.heap[i], this.heap[p]] = [this.heap[p], this.heap[i]];\n\t\t\ti = p;\n\t\t}\n\t}\n\t_sinkDown(i) {\n\t\tconst n = this.heap.length;\n\t\twhile (true) {\n\t\t\tlet smallest = i;\n\t\t\tconst l = 2 * i + 1, r = 2 * i + 2;\n\t\t\tif (l < n && this.cmp(this.heap[l], this.heap[smallest]) < 0) smallest = l;\n\t\t\tif (r < n && this.cmp(this.heap[r], this.heap[smallest]) < 0) smallest = r;\n\t\t\tif (smallest === i) break;\n\t\t\t[this.heap[i], this.heap[smallest]] = [this.heap[smallest], this.heap[i]];\n\t\t\ti = smallest;\n\t\t}\n\t}\n}',
    description: 'Priority Queue (JS)',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['bfs'],
    body: 'function bfs(start, graph) {\n\tconst q = [start];\n\tconst visited = new Set([start]);\n\twhile (q.length) {\n\t\tconst node = q.shift();\n\t\tfor (const nei of graph[node]) {\n\t\t\tif (!visited.has(nei)) {\n\t\t\t\tvisited.add(nei);\n\t\t\t\tq.push(nei);\n\t\t\t}\n\t\t}\n\t}\n}',
    description: 'BFS template',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },
  {
    prefix: ['dfs'],
    body: 'function dfs(node, graph, visited = new Set()) {\n\tvisited.add(node);\n\tfor (const nei of graph[node]) {\n\t\tif (!visited.has(nei)) dfs(nei, graph, visited);\n\t}\n}',
    description: 'DFS template',
    language: ['javascript', 'js', 'typescript', 'ts'],
  },

  // ═══════════════════════════════════════════════════════════════
  // GO SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  {
    prefix: ['for', 'fori'],
    body: 'for ${1:i} := 0; $1 < ${2:n}; $1++ {\n\t${0}\n}',
    description: 'For loop',
    language: ['go'],
  },
  {
    prefix: ['forr', 'fore'],
    body: 'for _, ${1:item} := range ${2:slice} {\n\t${0}\n}',
    description: 'Range loop',
    language: ['go'],
  },
  {
    prefix: ['while'],
    body: 'for ${1:condition} {\n\t${0}\n}',
    description: 'While loop (Go for)',
    language: ['go'],
  },
  {
    prefix: ['if'],
    body: 'if ${1:condition} {\n\t${0}\n}',
    description: 'If statement',
    language: ['go'],
  },
  {
    prefix: ['else'],
    body: '} else {\n\t${0}\n}',
    description: 'Else statement',
    language: ['go'],
  },
  {
    prefix: ['func'],
    body: 'func ${1:name}(${2:args}) ${3:returnType} {\n\t${0}\n}',
    description: 'Function',
    language: ['go'],
  },
  {
    prefix: ['sli'],
    body: '${1:s} := make([]${2:int}, ${3:n})',
    description: 'Make slice',
    language: ['go'],
  },
  {
    prefix: ['map'],
    body: '${1:m} := make(map[${2:int}]${3:int})',
    description: 'Make map',
    language: ['go'],
  },
  {
    prefix: ['append'],
    body: '${1:s} = append($1, ${2:val})',
    description: 'Append to slice',
    language: ['go'],
  },
  {
    prefix: ['sort'],
    body: 'sort.${1:Ints}(${2:v})',
    description: 'Sort slice',
    language: ['go'],
  },
  {
    prefix: ['fmt'],
    body: 'fmt.${1:Println}(${2:v})',
    description: 'Fmt print',
    language: ['go'],
  },
  {
    prefix: ['defer'],
    body: 'defer ${1:close}()',
    description: 'Defer call',
    language: ['go'],
  },
  {
    prefix: ['struct'],
    body: 'type ${1:Name} struct {\n\t${0}\n}',
    description: 'Struct definition',
    language: ['go'],
  },
  {
    prefix: ['bfs'],
    body: 'func bfs(start int, adj [][]int) {\n\tn := len(adj)\n\tq := []int{start}\n\tvisited := make([]bool, n)\n\tvisited[start] = true\n\tfor len(q) > 0 {\n\t\tu := q[0]\n\t\tq = q[1:]\n\t\tfor _, v := range adj[u] {\n\t\t\tif !visited[v] {\n\t\t\t\tvisited[v] = true\n\t\t\t\tq = append(q, v)\n\t\t\t}\n\t\t}\n\t}\n}',
    description: 'BFS template',
    language: ['go'],
  },

  // ═══════════════════════════════════════════════════════════════
  // RUST SNIPPETS
  // ═══════════════════════════════════════════════════════════════

  {
    prefix: ['for', 'fori'],
    body: 'for ${1:i} in 0..${2:n} {\n\t${0}\n}',
    description: 'For loop',
    language: ['rust'],
  },
  {
    prefix: ['forr', 'fore'],
    body: 'for ${1:item} in ${2:iterable} {\n\t${0}\n}',
    description: 'For-each loop',
    language: ['rust'],
  },
  {
    prefix: ['while'],
    body: 'while ${1:condition} {\n\t${0}\n}',
    description: 'While loop',
    language: ['rust'],
  },
  {
    prefix: ['if'],
    body: 'if ${1:condition} {\n\t${0}\n}',
    description: 'If statement',
    language: ['rust'],
  },
  {
    prefix: ['fn'],
    body: 'fn ${1:name}(${2:args}) -> ${3:ReturnType} {\n\t${0}\n}',
    description: 'Function',
    language: ['rust'],
  },
  {
    prefix: ['let'],
    body: 'let ${1:var} = ${2:value};',
    description: 'Let binding',
    language: ['rust'],
  },
  {
    prefix: ['letmut'],
    body: 'let mut ${1:var} = ${2:value};',
    description: 'Mutable let binding',
    language: ['rust'],
  },
  {
    prefix: ['vec'],
    body: 'let mut ${1:v} = Vec::new();',
    description: 'New vector',
    language: ['rust'],
  },
  {
    prefix: ['vecmacro'],
    body: 'vec![${1:value}; ${2:n}]',
    description: 'Vector macro',
    language: ['rust'],
  },
  {
    prefix: ['hm'],
    body: 'use std::collections::HashMap;\nlet mut ${1:map}: HashMap<${2: K}, ${3: V}> = HashMap::new();',
    description: 'HashMap',
    language: ['rust'],
  },
  {
    prefix: ['hs'],
    body: 'use std::collections::HashSet;\nlet mut ${1:set}: HashSet<${2: T}> = HashSet::new();',
    description: 'HashSet',
    language: ['rust'],
  },
  {
    prefix: ['match'],
    body: 'match ${1:value} {\n\t${2:Pattern} => ${3:result},\n\t_ => {}\n}',
    description: 'Match expression',
    language: ['rust'],
  },
  {
    prefix: ['impl'],
    body: 'impl ${1:Type} {\n\tfn ${2:new}(${3:args}) -> Self {\n\t\tSelf { ${0} }\n\t}\n}',
    description: 'Impl block',
    language: ['rust'],
  },
  {
    prefix: ['readints'],
    body: 'let ${1:input} = io::stdin();\nlet mut ${2:line} = String::new();\n$1.read_line(&mut $2).unwrap();\nlet ${3:ints}: Vec<i32> = $2.split_whitespace().map(|x| x.parse().unwrap()).collect();',
    description: 'Read ints from stdin',
    language: ['rust'],
  },
  {
    prefix: ['bfs'],
    body: 'use std::collections::VecDeque;\n\nfn bfs(start: usize, adj: &Vec<Vec<usize>>) {\n\tlet n = adj.len();\n\tlet mut q = VecDeque::new();\n\tlet mut visited = vec![false; n];\n\tq.push_back(start);\n\tvisited[start] = true;\n\twhile let Some(u) = q.pop_front() {\n\t\tfor &v in &adj[u] {\n\t\t\tif !visited[v] {\n\t\t\t\tvisited[v] = true;\n\t\t\t\tq.push_back(v);\n\t\t\t}\n\t\t}\n\t}\n}',
    description: 'BFS template',
    language: ['rust'],
  },
  {
    prefix: ['dijkstra'],
    body: 'use std::collections::BinaryHeap;\nuse std::cmp::Reverse;\n\nfn dijkstra(start: usize, adj: &Vec<Vec<(usize, i32)>>) -> Vec<i32> {\n\tlet n = adj.len();\n\tlet mut dist = vec![i32::MAX; n];\n\tlet mut pq = BinaryHeap::new();\n\tdist[start] = 0;\n\tpq.push(Reverse((0, start)));\n\twhile let Some(Reverse((d, u))) = pq.pop() {\n\t\tif d > dist[u] { continue; }\n\t\tfor &(v, w) in &adj[u] {\n\t\t\tif dist[u] + w < dist[v] {\n\t\t\t\tdist[v] = dist[u] + w;\n\t\t\t\tpq.push(Reverse((dist[v], v)));\n\t\t\t}\n\t\t}\n\t}\n\tdist\n}',
    description: 'Dijkstra template',
    language: ['rust'],
  },
];
