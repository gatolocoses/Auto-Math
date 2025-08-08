(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MathEval = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  function normalizeExpression(expression) {
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
          outputQueue.push(parseFloat(token.slice(0, -1)) / 100);
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
      if (token === 'u+' || token === 'u-') {
        const a = stack.pop();
        if (a === undefined) throw new Error('Invalid expression');
        stack.push(token === 'u+' ? +a : -a);
        continue;
      }
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) throw new Error('Invalid expression');
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(b === 0 ? NaN : a / b); break;
        default: throw new Error('Invalid operator');
      }
    }

    if (stack.length !== 1) throw new Error('Invalid expression');
    return stack[0];
  }

  function evaluateExpression(rawExpression) {
    try {
      const expr = normalizeExpression(rawExpression);
      const value = simpleParser(expr);
      if (!Number.isFinite(value)) return 'Invalid expression';
      let formatted = value.toFixed(8).replace(/\.?0+$/, '');
      return formatted;
    } catch (e) {
      console.error('Error evaluating expression:', e);
      return 'Invalid expression';
    }
  }

  return { normalizeExpression, simpleParser, evaluateExpression };
});