(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MathEval = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function tokenizeRaw(raw) {
    const tokens = [];
    let i = 0;
    while (i < raw.length) {
      const ch = raw[i];
      // Whitespace
      if (/\s/.test(ch)) {
        let j = i + 1;
        while (j < raw.length && /\s/.test(raw[j])) j++;
        tokens.push({ type: 'ws', value: raw.slice(i, j) });
        i = j;
        continue;
      }
      // Number (with optional decimal), optional % suffix
      if (/[0-9]/.test(ch)) {
        let j = i + 1;
        while (j < raw.length && /[0-9]/.test(raw[j])) j++;
        if (raw[j] === '.') {
          j++;
          while (j < raw.length && /[0-9]/.test(raw[j])) j++;
        }
        if (raw[j] === '%') {
          j++;
        }
        tokens.push({ type: 'number', value: raw.slice(i, j) });
        i = j;
        continue;
      }
      // Parentheses
      if (ch === '(' || ch === ')') {
        tokens.push({ type: 'paren', value: ch });
        i++;
        continue;
      }
      // Operators + - /
      if (ch === '+' || ch === '-' || ch === '/') {
        tokens.push({ type: 'op', value: ch });
        i++;
        continue;
      }
      // Capital X (multiplication operator by design)
      if (ch === 'X') {
        tokens.push({ type: 'op', value: 'X' });
        i++;
        continue;
      }
      // Words (letters)
      if (/[A-Za-z]/.test(ch)) {
        let j = i + 1;
        while (j < raw.length && /[A-Za-z]/.test(raw[j])) j++;
        tokens.push({ type: 'word', value: raw.slice(i, j) });
        i = j;
        continue;
      }
      // Ignore any other characters
      i++;
    }
    return tokens;
  }

  function buildNumericExpressionAndUnit(raw) {
    const tokens = tokenizeRaw(raw);
    // Determine unit: word immediately following the first number (ignoring whitespace)
    let unit = '';
    let firstNumberIndex = tokens.findIndex(t => t.type === 'number');
    if (firstNumberIndex !== -1) {
      let j = firstNumberIndex + 1;
      while (j < tokens.length && tokens[j].type === 'ws') j++;
      if (j < tokens.length && tokens[j].type === 'word') {
        unit = tokens[j].value;
      }
    }

    // Build numeric-only expression: keep numbers, parens, + - /, and X=>*
    const parts = [];
    for (const t of tokens) {
      if (t.type === 'number' || t.type === 'paren' || (t.type === 'op' && (t.value === '+' || t.value === '-' || t.value === '/' || t.value === 'X'))) {
        if (t.type === 'op' && t.value === 'X') {
          parts.push('*');
        } else {
          parts.push(t.value);
        }
      }
    }
    const expr = parts.join(' ').replace(/\s+/g, ' ').trim();
    return { expr, unit };
  }

  function normalizeExpression(expression) {
    // Kept for direct math-only inputs; still restrict to allowed characters
    let expr = expression.replace(/X/g, '*');
    expr = expr.replace(/\s+/g, ' ').trim();
    if (/[^0-9.+\-*/()%()\s]/.test(expr)) {
      throw new Error('Invalid characters in expression');
    }
    return expr;
  }

  function simpleParser(expression) {
    const tokens = expression.match(/(\d+(?:\.\d+)?%?|\+|\-|\*|\/|\(|\))/g);
    if (!tokens) throw new Error('Invalid expression');

    const outputQueue = [];
    const operatorStack = [];
    const precedence = { 'u+': 3, 'u-': 3, '*': 2, '/': 2, '+': 1, '-': 1 };
    const associativity = { '*': 'L', '/': 'L', '+': 'L', '-': 'L', 'u+': 'R', 'u-': 'R' };
    const isBinaryOperator = (t) => t === '+' || t === '-' || t === '*' || t === '/';

    const normalized = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const prev = normalized[normalized.length - 1];
      if ((t === '+' || t === '-') && (i === 0 || isBinaryOperator(prev) || prev === '(' || prev === 'u+' || prev === 'u-')) {
        normalized.push(t === '+' ? 'u+' : 'u-');
      } else {
        normalized.push(t);
      }
    }

    for (const token of normalized) {
      if (/^\d+(?:\.\d+)?%?$/.test(token)) {
        if (token.endsWith('%')) {
          outputQueue.push({ type: 'percent', value: parseFloat(token.slice(0, -1)) / 100 });
        } else {
          outputQueue.push(parseFloat(token));
        }
        continue;
      }
      if (token in precedence) {
        while (
          operatorStack.length &&
          (operatorStack[operatorStack.length - 1] in precedence) &&
          ((associativity[token] === 'L' && precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]) ||
            (associativity[token] === 'R' && precedence[operatorStack[operatorStack.length - 1]] > precedence[token]))
        ) {
          outputQueue.push(operatorStack.pop());
        }
        operatorStack.push(token);
        continue;
      }
      if (token === '(') { operatorStack.push(token); continue; }
      if (token === ')') {
        while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
          outputQueue.push(operatorStack.pop());
        }
        if (operatorStack.length === 0 || operatorStack[operatorStack.length - 1] !== '(') {
          throw new Error('Mismatched parentheses');
        }
        operatorStack.pop();
        continue;
      }
      throw new Error('Invalid token in expression');
    }

    while (operatorStack.length) {
      const op = operatorStack.pop();
      if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
      outputQueue.push(op);
    }

    const stack = [];
    for (const token of outputQueue) {
      if (typeof token === 'number') { stack.push(token); continue; }
      if (token && typeof token === 'object' && token.type === 'percent') { stack.push(token); continue; }
      if (token === 'u+' || token === 'u-') {
        const a = stack.pop();
        if (a === undefined) throw new Error('Invalid expression');
        stack.push(token === 'u+' ? +a : -a);
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');

      // Handle percent tokens contextually
      const isPercent = (v) => v && typeof v === 'object' && v.type === 'percent';
      const percentToNumber = (v) => isPercent(v) ? v.value : v;

      switch (token) {
        case '+':
          if (isPercent(b)) { stack.push(a + a * b.value); }
          else if (isPercent(a)) { stack.push(b + b * a.value); }
          else { stack.push(a + b); }
          break;
        case '-':
          if (isPercent(b)) { stack.push(a - a * b.value); }
          else if (isPercent(a)) { stack.push(b - b * a.value); } // rare, but keeps symmetry
          else { stack.push(a - b); }
          break;
        case '*':
          stack.push(percentToNumber(a) * percentToNumber(b));
          break;
        case '/':
          stack.push(percentToNumber(b) === 0 ? NaN : percentToNumber(a) / percentToNumber(b));
          break;
        default: throw new Error('Invalid operator');
      }
    }

    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
  }

  function evaluateExpression(rawExpression) {
    // Build a math-only expression but remember a unit immediately after the first number
    const { expr, unit } = buildNumericExpressionAndUnit(rawExpression);
    if (!expr) return 'Invalid expression';

    const value = simpleParser(expr);
    if (!Number.isFinite(value)) return 'Invalid expression';

    let formatted = value.toFixed(8).replace(/\.?0+$/, '');
    if (unit) formatted += ' ' + unit;
    return formatted;
  }

  return { tokenizeRaw, normalizeExpression, simpleParser, evaluateExpression };
});