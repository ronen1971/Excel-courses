/* Mini Excel formula engine: parser + evaluator. No dependencies. */
(function (root) {
  'use strict';

  class XlError extends Error {
    constructor(code) { super(code); this.code = code; }
  }

  const colToNum = s => s.toUpperCase().split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0);
  const numToCol = n => {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const CELL_RE = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;
  const parseRef = s => { const m = CELL_RE.exec(s); return m ? { col: colToNum(m[1]), row: +m[2] } : null; };

  function tokenize(src) {
    const out = []; let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) { i++; continue; }
      if (c === '"') {
        let j = i + 1, s = '';
        for (;;) {
          if (j >= src.length) throw new XlError('#ERR');
          if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; }
          s += src[j++];
        }
        out.push({ t: 'str', v: s }); i = j + 1; continue;
      }
      const rest = src.slice(i);
      let m;
      if ((m = /^(\d+(\.\d+)?|\.\d+)/.exec(rest))) { out.push({ t: 'num', v: parseFloat(m[0]) }); i += m[0].length; continue; }
      if ((m = /^[A-Za-z_$][A-Za-z0-9_.$]*/.exec(rest))) { out.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>)/.exec(rest))) { out.push({ t: 'op', v: m[0] }); i += 2; continue; }
      if ('+-*/^&=<>(),:%'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
      throw new XlError('#ERR');
    }
    return out;
  }

  const isRange = v => v && v.range === true;
  const toNum = v => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'number') return v;
    const n = Number(String(v).trim());
    if (String(v).trim() === '' || Number.isNaN(n)) throw new XlError('#VALUE!');
    return n;
  };
  const toStr = v => (v === null || v === undefined) ? '' : typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : String(v);
  const toBool = v => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') { const u = v.toUpperCase(); if (u === 'TRUE') return true; if (u === 'FALSE') return false; throw new XlError('#VALUE!'); }
    return toNum(v) !== 0;
  };
  const scalar = v => { if (isRange(v)) throw new XlError('#VALUE!'); return v; };
  const flat = v => isRange(v) ? v.rows.flat() : [v];

  function compare(a, b) {
    if (a === null) a = typeof b === 'string' ? '' : (typeof b === 'boolean' ? false : 0);
    if (b === null) b = typeof a === 'string' ? '' : (typeof a === 'boolean' ? false : 0);
    const rank = v => typeof v === 'number' ? 0 : typeof v === 'string' ? 1 : 2;
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (typeof a === 'string') { a = a.toLowerCase(); b = b.toLowerCase(); }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  function matcher(crit) {
    let op = '=', val = crit;
    if (typeof crit === 'string') {
      const m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(crit);
      op = m[1] || '='; val = m[2];
      if (val.trim() !== '' && !Number.isNaN(Number(val))) val = Number(val);
    }
    return cell => {
      if (typeof val === 'number' && typeof cell !== 'number') return op === '<>';
      if (typeof val === 'string' && typeof cell !== 'string') return op === '<>' && !(val === '' && cell === null);
      const c = compare(cell, val);
      return { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
    };
  }

  const roundTo = (n, d) => {
    const s = Math.sign(n);
    return s * Number(Math.round(Math.abs(n) + 'e' + d) + 'e-' + d);
  };
  const nums = args => {
    const out = [];
    args.forEach(a => {
      if (isRange(a)) a.rows.flat().forEach(v => { if (typeof v === 'number') out.push(v); });
      else out.push(toNum(a));
    });
    return out;
  };
  const need = (args, min, max) => { if (args.length < min || args.length > max) throw new XlError('#VALUE!'); };

  const FUNCS = {
    SUM: a => nums(a).reduce((x, y) => x + y, 0),
    AVERAGE: a => { const n = nums(a); if (!n.length) throw new XlError('#DIV/0!'); return n.reduce((x, y) => x + y, 0) / n.length; },
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: a => a.reduce((c, x) => c + flat(x).filter(v => typeof v === 'number').length, 0),
    COUNTA: a => a.reduce((c, x) => c + flat(x).filter(v => v !== null && v !== '').length, 0),
    ABS: a => { need(a, 1, 1); return Math.abs(toNum(scalar(a[0]))); },
    ROUND: a => { need(a, 2, 2); return roundTo(toNum(scalar(a[0])), Math.trunc(toNum(scalar(a[1])))); },
    IF: a => { need(a, 2, 3); return toBool(scalar(a[0])) ? a[1] : (a.length > 2 ? a[2] : false); },
    AND: a => a.every(x => flat(x).every(v => toBool(v))),
    OR: a => a.some(x => flat(x).some(v => toBool(v))),
    NOT: a => { need(a, 1, 1); return !toBool(scalar(a[0])); },
    COUNTIF: a => {
      need(a, 2, 2); if (!isRange(a[0])) throw new XlError('#VALUE!');
      const t = matcher(scalar(a[1])); return a[0].rows.flat().filter(t).length;
    },
    SUMIF: a => {
      need(a, 2, 3); if (!isRange(a[0])) throw new XlError('#VALUE!');
      const t = matcher(scalar(a[1]));
      const crit = a[0].rows.flat();
      const sum = a.length > 2 ? (isRange(a[2]) ? a[2].rows.flat() : [a[2]]) : crit;
      return crit.reduce((s, v, i) => (t(v) && typeof sum[i] === 'number') ? s + sum[i] : s, 0);
    },
    VLOOKUP: a => {
      need(a, 3, 4); if (!isRange(a[1])) throw new XlError('#VALUE!');
      const key = scalar(a[0]), idx = Math.trunc(toNum(scalar(a[2])));
      const approx = a.length > 3 ? toBool(scalar(a[3])) : true;
      const rows = a[1].rows;
      if (idx < 1 || idx > rows[0].length) throw new XlError('#REF!');
      if (!approx) {
        const r = rows.find(r => r[0] !== null && compare(r[0], key) === 0 && typeof r[0] === typeof key);
        if (!r) throw new XlError('#N/A'); return r[idx - 1];
      }
      let hit = null;
      rows.forEach(r => { if (r[0] !== null && typeof r[0] === typeof key && compare(r[0], key) <= 0) hit = r; });
      if (!hit) throw new XlError('#N/A'); return hit[idx - 1];
    },
    CONCATENATE: a => a.map(x => flat(x).map(toStr).join('')).join(''),
    CONCAT: a => FUNCS.CONCATENATE(a),
    LEN: a => { need(a, 1, 1); return toStr(scalar(a[0])).length; },
    LEFT: a => { need(a, 1, 2); return toStr(scalar(a[0])).slice(0, a.length > 1 ? toNum(a[1]) : 1); },
    RIGHT: a => { need(a, 1, 2); const s = toStr(scalar(a[0])), n = a.length > 1 ? toNum(a[1]) : 1; return n ? s.slice(-n) : ''; },
    UPPER: a => { need(a, 1, 1); return toStr(scalar(a[0])).toUpperCase(); },
    LOWER: a => { need(a, 1, 1); return toStr(scalar(a[0])).toLowerCase(); },
    TRIM: a => { need(a, 1, 1); return toStr(scalar(a[0])).trim().replace(/\s+/g, ' '); }
  };

  /** Evaluate a formula string ("=...") using getCell(col,row) -> value. Throws XlError. */
  function evaluate(formula, getCell) {
    const tokens = tokenize(formula.replace(/^\s*=/, ''));
    if (!tokens.length) throw new XlError('#ERR');
    let p = 0;
    const peek = () => tokens[p];
    const isOp = v => tokens[p] && tokens[p].t === 'op' && tokens[p].v === v;
    const eat = v => { if (!isOp(v)) throw new XlError('#ERR'); p++; };

    const cmp = () => {
      let l = cat();
      while (tokens[p] && tokens[p].t === 'op' && ['=', '<>', '<', '>', '<=', '>='].includes(tokens[p].v)) {
        const op = tokens[p++].v, r = cat(); const c = compare(scalar(l), scalar(r));
        l = { '=': c === 0, '<>': c !== 0, '<': c < 0, '>': c > 0, '<=': c <= 0, '>=': c >= 0 }[op];
      }
      return l;
    };
    const cat = () => {
      let l = add();
      while (isOp('&')) { p++; const r = add(); l = toStr(scalar(l)) + toStr(scalar(r)); }
      return l;
    };
    const add = () => {
      let l = mul();
      while (isOp('+') || isOp('-')) {
        const op = tokens[p++].v, r = mul();
        l = op === '+' ? toNum(scalar(l)) + toNum(scalar(r)) : toNum(scalar(l)) - toNum(scalar(r));
      }
      return l;
    };
    const mul = () => {
      let l = pow();
      while (isOp('*') || isOp('/')) {
        const op = tokens[p++].v, r = pow();
        const a = toNum(scalar(l)), b = toNum(scalar(r));
        if (op === '/' && b === 0) throw new XlError('#DIV/0!');
        l = op === '*' ? a * b : a / b;
      }
      return l;
    };
    const pow = () => {
      let l = unary();
      while (isOp('^')) { p++; l = Math.pow(toNum(scalar(l)), toNum(scalar(unary()))); }
      return l;
    };
    const unary = () => {
      if (isOp('-')) { p++; return -toNum(scalar(unary())); }
      if (isOp('+')) { p++; return unary(); }
      return postfix();
    };
    const postfix = () => {
      let v = primary();
      while (isOp('%')) { p++; v = toNum(scalar(v)) / 100; }
      return v;
    };
    const primary = () => {
      const t = peek();
      if (!t) throw new XlError('#ERR');
      if (t.t === 'num') { p++; return t.v; }
      if (t.t === 'str') { p++; return t.v; }
      if (isOp('(')) { p++; const v = cmp(); eat(')'); return v; }
      if (t.t === 'id') {
        p++;
        if (isOp('(')) {
          const fn = FUNCS[t.v.toUpperCase()];
          if (!fn) throw new XlError('#NAME?');
          p++;
          const args = [];
          if (!isOp(')')) { for (;;) { args.push(cmp()); if (isOp(',')) { p++; continue; } break; } }
          eat(')');
          return fn(args);
        }
        const up = t.v.toUpperCase();
        if (up === 'TRUE') return true;
        if (up === 'FALSE') return false;
        const a = parseRef(t.v);
        if (!a) throw new XlError('#NAME?');
        if (isOp(':')) {
          p++;
          const t2 = peek();
          const b = t2 && t2.t === 'id' ? parseRef(t2.v) : null;
          if (!b) throw new XlError('#REF!');
          p++;
          const rows = [];
          for (let r = Math.min(a.row, b.row); r <= Math.max(a.row, b.row); r++) {
            const line = [];
            for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c++) line.push(getCell(c, r));
            rows.push(line);
          }
          return { range: true, rows };
        }
        return getCell(a.col, a.row);
      }
      throw new XlError('#ERR');
    };

    let result = cmp();
    if (p < tokens.length) throw new XlError('#ERR');
    if (isRange(result)) result = result.rows[0][0];
    return result === undefined ? null : result;
  }

  const api = { evaluate, XlError, colToNum, numToCol, parseRef };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
