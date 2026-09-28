/**
 * Minimal regular-expression engine answering one question that native
 * `RegExp` cannot: *"can this digit prefix still be completed into a string
 * matching the pattern?"*
 *
 * It is what lets the field turn red **while typing** as soon as a number is
 * certainly wrong (e.g. `9` as the first digit of a French number), instead
 * of waiting for the full length.
 *
 * Supported syntax: the subset used by libphonenumber metadata (and by most
 * hand-written phone regexes): literals, `\d`, `.`, `[...]` classes with
 * ranges and negation, `(...)`, `(?:...)`, `|`, `?`, `*`, `+`, `{n}`,
 * `{n,}`, `{n,m}`, lazy quantifiers and `^` / `$` anchors at the ends.
 * Anything else throws; callers treat that as "unknown" and never show a
 * false error.
 *
 * Only digits are ever fed to the automaton, so every character class is a
 * 10-bit mask.
 */

type AstNode =
  | { kind: 'char'; mask: number }
  | { kind: 'seq'; items: AstNode[] }
  | { kind: 'alt'; options: AstNode[] }
  | { kind: 'repeat'; node: AstNode; min: number; max: number };

const ALL_DIGITS = 0b1111111111;
const MAX_EXPANSION = 64;

class PatternSyntaxError extends Error {}

function digitMask(ch: string): number {
  const code = ch.charCodeAt(0) - 48;
  return code >= 0 && code <= 9 ? 1 << code : 0;
}

function parse(source: string): AstNode {
  let pos = 0;
  let src = source;
  if (src.startsWith('^')) src = src.slice(1);
  if (src.endsWith('$') && !src.endsWith('\\$')) src = src.slice(0, -1);

  const peek = () => src[pos];
  const eat = (expected?: string): string => {
    const ch = src[pos];
    if (ch === undefined || (expected !== undefined && ch !== expected)) {
      throw new PatternSyntaxError(`Unexpected token at ${pos} in ${source}`);
    }
    pos += 1;
    return ch;
  };

  function parseAlternation(): AstNode {
    const options: AstNode[] = [parseSequence()];
    while (peek() === '|') {
      eat('|');
      options.push(parseSequence());
    }
    return options.length === 1 ? options[0]! : { kind: 'alt', options };
  }

  function parseSequence(): AstNode {
    const items: AstNode[] = [];
    while (pos < src.length && peek() !== '|' && peek() !== ')') {
      items.push(parseQuantified());
    }
    return items.length === 1 ? items[0]! : { kind: 'seq', items };
  }

  function readInt(): number {
    const start = pos;
    while (pos < src.length && /[0-9]/.test(src[pos]!)) pos += 1;
    if (start === pos)
      throw new PatternSyntaxError(`Expected number in ${source}`);
    return Number(src.slice(start, pos));
  }

  function parseQuantified(): AstNode {
    const atom = parseAtom();
    let min = 1;
    let max = 1;
    const ch = peek();
    if (ch === '?') {
      eat();
      min = 0;
    } else if (ch === '*') {
      eat();
      min = 0;
      max = Infinity;
    } else if (ch === '+') {
      eat();
      max = Infinity;
    } else if (ch === '{') {
      eat('{');
      min = readInt();
      max = min;
      if (peek() === ',') {
        eat(',');
        max = peek() === '}' ? Infinity : readInt();
      }
      eat('}');
      if (max < min) throw new PatternSyntaxError(`Bad range in ${source}`);
    } else {
      return atom;
    }
    if (peek() === '?') eat(); // lazy quantifier: same language
    return { kind: 'repeat', node: atom, min, max };
  }

  function parseClass(): AstNode {
    eat('[');
    let negate = false;
    if (peek() === '^') {
      eat();
      negate = true;
    }
    let mask = 0;
    let first = true;
    while (peek() !== ']' || first) {
      first = false;
      let ch = eat();
      if (ch === '\\') {
        const esc = eat();
        if (esc === 'd') {
          mask |= ALL_DIGITS;
          continue;
        }
        ch = esc;
      }
      if (
        peek() === '-' &&
        src[pos + 1] !== ']' &&
        src[pos + 1] !== undefined
      ) {
        eat('-');
        let end = eat();
        if (end === '\\') end = eat();
        const from = ch.charCodeAt(0);
        const to = end.charCodeAt(0);
        if (to < from)
          throw new PatternSyntaxError(`Bad class range in ${source}`);
        for (let c = Math.max(from, 48); c <= Math.min(to, 57); c += 1) {
          mask |= 1 << (c - 48);
        }
      } else {
        mask |= digitMask(ch);
      }
    }
    eat(']');
    return { kind: 'char', mask: negate ? ALL_DIGITS & ~mask : mask };
  }

  function parseAtom(): AstNode {
    const ch = peek();
    if (ch === '(') {
      eat('(');
      if (peek() === '?') {
        eat('?');
        eat(':');
      }
      const inner = parseAlternation();
      eat(')');
      return inner;
    }
    if (ch === '[') return parseClass();
    if (ch === '\\') {
      eat('\\');
      const esc = eat();
      if (esc === 'd') return { kind: 'char', mask: ALL_DIGITS };
      if (/[a-zA-Z]/.test(esc)) {
        throw new PatternSyntaxError(
          `Unsupported escape \\${esc} in ${source}`
        );
      }
      return { kind: 'char', mask: digitMask(esc) };
    }
    if (ch === '.') {
      eat();
      return { kind: 'char', mask: ALL_DIGITS };
    }
    if (
      ch === undefined ||
      ch === ')' ||
      ch === '|' ||
      '*+?{}^$'.includes(ch)
    ) {
      throw new PatternSyntaxError(`Unexpected "${ch}" in ${source}`);
    }
    eat();
    return { kind: 'char', mask: digitMask(ch) };
  }

  const ast = parseAlternation();
  if (pos !== src.length) {
    throw new PatternSyntaxError(`Trailing input at ${pos} in ${source}`);
  }
  return ast;
}

/**
 * Thompson NFA. State `i` either consumes one digit of `masks[i]` and goes
 * to `next[i]`, or (mask 0) follows its epsilon transitions `eps[i]`.
 */
class Nfa {
  masks: number[] = [];
  next: number[] = [];
  eps: number[][] = [];
  start = 0;
  accept = 0;

  newState(): number {
    this.masks.push(0);
    this.next.push(-1);
    this.eps.push([]);
    return this.masks.length - 1;
  }

  /** Builds `node` between `from` and a fresh end state, which is returned. */
  build(node: AstNode, from: number): number {
    switch (node.kind) {
      case 'char': {
        const end = this.newState();
        this.masks[from] = node.mask;
        this.next[from] = end;
        // A consuming state cannot also carry epsilons: insert a hop.
        return end;
      }
      case 'seq': {
        let cur = from;
        for (const item of node.items) cur = this.link(item, cur);
        return cur;
      }
      case 'alt': {
        const end = this.newState();
        for (const option of node.options) {
          const s = this.newState();
          this.eps[from]!.push(s);
          const e = this.link(option, s);
          this.eps[e]!.push(end);
        }
        return end;
      }
      case 'repeat': {
        const { min, max } = node;
        if (min > MAX_EXPANSION || (max !== Infinity && max > MAX_EXPANSION)) {
          throw new PatternSyntaxError('Quantifier too large');
        }
        let cur = from;
        for (let i = 0; i < min; i += 1) cur = this.link(node.node, cur);
        if (max === Infinity) {
          const loop = this.newState();
          this.eps[cur]!.push(loop);
          const body = this.newState();
          const exit = this.newState();
          this.eps[loop]!.push(body, exit);
          const e = this.link(node.node, body);
          this.eps[e]!.push(loop);
          return exit;
        }
        const end = this.newState();
        for (let i = min; i < max; i += 1) {
          this.eps[cur]!.push(end);
          cur = this.link(node.node, cur);
        }
        this.eps[cur]!.push(end);
        return end;
      }
    }
  }

  /** Like `build`, but guarantees `from` has no consuming transition yet. */
  private link(node: AstNode, from: number): number {
    if (node.kind === 'char') {
      const s = this.newState();
      this.eps[from]!.push(s);
      return this.build(node, s);
    }
    return this.build(node, from);
  }

  closure(states: Iterable<number>): Set<number> {
    const result = new Set<number>();
    const stack = [...states];
    while (stack.length) {
      const s = stack.pop()!;
      if (result.has(s)) continue;
      result.add(s);
      for (const t of this.eps[s]!) stack.push(t);
    }
    return result;
  }

  step(states: Set<number>, digit: number): Set<number> {
    const bit = 1 << digit;
    const out: number[] = [];
    for (const s of states) {
      if (this.masks[s]! & bit) out.push(this.next[s]!);
    }
    return this.closure(out);
  }
}

export interface CompiledPattern {
  /** `true` if some completion of `digits` fully matches the pattern. */
  canStartWith(digits: string): boolean;
  /** `true` if `digits` fully matches the pattern. */
  matches(digits: string): boolean;
  /**
   * Builds one string of exactly `length` digits matching the pattern, or
   * `null`. Deterministic (prefers the smallest digit at each step).
   */
  sample(length: number): string | null;
}

function compileAst(ast: AstNode): CompiledPattern {
  const nfa = new Nfa();
  nfa.start = nfa.newState();
  nfa.accept = nfa.build(ast, nfa.start);
  const initial = nfa.closure([nfa.start]);

  const run = (digits: string): Set<number> | null => {
    let states = initial;
    for (const ch of digits) {
      const d = ch.charCodeAt(0) - 48;
      if (d < 0 || d > 9) return null;
      states = nfa.step(states, d);
      if (states.size === 0) return null;
    }
    return states;
  };

  return {
    canStartWith: (digits) => run(digits) !== null,
    matches: (digits) => run(digits)?.has(nfa.accept) ?? false,
    sample(length) {
      // Depth-first search with memoised dead ends.
      const dead = new Set<string>();
      const key = (states: Set<number>, remaining: number) =>
        `${remaining}:${[...states].sort((a, b) => a - b).join(',')}`;
      const search = (
        states: Set<number>,
        remaining: number
      ): string | null => {
        if (remaining === 0) return states.has(nfa.accept) ? '' : null;
        const k = key(states, remaining);
        if (dead.has(k)) return null;
        for (let d = 0; d <= 9; d += 1) {
          const next = nfa.step(states, d);
          if (next.size === 0) continue;
          const rest = search(next, remaining - 1);
          if (rest !== null) return String(d) + rest;
        }
        dead.add(k);
        return null;
      };
      return search(initial, length);
    },
  };
}

const cache = new Map<string, CompiledPattern | null>();

/**
 * Compiles a pattern (string source or RegExp). Returns `null` when the
 * pattern uses unsupported syntax. Results are cached by source.
 */
export function compilePattern(
  pattern: string | RegExp
): CompiledPattern | null {
  const source = typeof pattern === 'string' ? pattern : pattern.source;
  if (cache.has(source)) return cache.get(source)!;
  let compiled: CompiledPattern | null;
  try {
    compiled = compileAst(parse(source));
  } catch {
    compiled = null;
  }
  cache.set(source, compiled);
  return compiled;
}

/**
 * `true` when `digits` can still become a full match of `pattern`.
 * Unknown syntax → `true` (never report a false error).
 */
export function canStartWith(
  pattern: string | RegExp,
  digits: string
): boolean {
  const compiled = compilePattern(pattern);
  return compiled ? compiled.canStartWith(digits) : true;
}
