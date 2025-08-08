let isUpdating = false;

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Determine active line bounds in a multiline input based on caret
function getActiveLineBounds(value, caretIndex) {
    const start = value.lastIndexOf('\n', Math.max(0, caretIndex - 1)) + 1; // if not found, -1 -> 0
    const nextNewline = value.indexOf('\n', caretIndex);
    const end = nextNewline === -1 ? value.length : nextNewline;
    return { start, end };
}

// Keep the original trigger behavior: expression ending with '=  ' (two spaces)
// Support multiple expressions on the same line by evaluating only the segment
// after the last '=' before the trailing trigger.
function parseEquation(lineText) {
    // Require that the line ends with '=  '
    if (!/\s*=\s{2}$/.test(lineText)) return null;

    // Remove the trailing trigger to inspect the head segment
    const head = lineText.replace(/\s*=\s{2}$/, '');

    // Find the last '=' before the trigger, if any
    const lastEqIndex = head.lastIndexOf('=');

    // Left part includes everything up to and including the last '='
    const leftPart = lastEqIndex >= 0 ? head.slice(0, lastEqIndex + 1) : '';

    // The expression segment is whatever comes after the last '=' (or the whole head if none)
    const exprSegmentOriginal = lastEqIndex >= 0 ? head.slice(lastEqIndex + 1) : head;

    const expression = exprSegmentOriginal.trim();
    if (!expression || !/\d/.test(expression)) return null;

    return { expression, leftPart, exprSegmentOriginal };
}

function evaluateExpression(rawExpression) {
    try {
        const expr = normalizeExpression(rawExpression);
        const value = simpleParser(expr);
        if (!Number.isFinite(value)) return 'Invalid expression';

        // Format result: up to 8 decimals, trim trailing zeros
        let formatted = value.toFixed(8).replace(/\.?0+$/, '');
        return formatted;
    } catch (e) {
        console.error('Error evaluating expression:', e);
        return 'Invalid expression';
    }
}

// Only map capital X to '*'; leave other symbols unchanged
function normalizeExpression(expression) {
    // Replace only capital X with * for multiplication
    let expr = expression.replace(/X/g, '*');

    // Collapse multiple spaces to single spaces for cleaner tokenization
    expr = expr.replace(/\s+/g, ' ').trim();

    // Validate allowed characters (digits, dot, whitespace, + - * / ( ) %)
    // Note: We allow capital X in input but it was converted above
    if (/[^0-9.+\-*/()%()\s]/.test(expr)) {
        throw new Error('Invalid characters in expression');
    }

    return expr;
}

// Shunting-yard parser with unary +/-, %, parentheses validation, and + - * /
function simpleParser(expression) {
    // Tokenize: numbers (optional decimal and %), operators, parentheses
    const tokens = expression.match(/(\d+(?:\.\d+)?%?|\+|\-|\*|\/|\(|\))/g);
    if (!tokens) throw new Error('Invalid expression');

    const outputQueue = [];
    const operatorStack = [];

    const precedence = { 'u+': 3, 'u-': 3, '*': 2, '/': 2, '+': 1, '-': 1 };
    const associativity = { '*': 'L', '/': 'L', '+': 'L', '-': 'L', 'u+': 'R', 'u-': 'R' };

    const isBinaryOperator = (t) => t === '+' || t === '-' || t === '*' || t === '/';

    // Normalize tokens to mark unary +/-
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
                (
                    (associativity[token] === 'L' && precedence[operatorStack[operatorStack.length - 1]] >= precedence[token]) ||
                    (associativity[token] === 'R' && precedence[operatorStack[operatorStack.length - 1]] > precedence[token])
                )
            ) {
                outputQueue.push(operatorStack.pop());
            }
            operatorStack.push(token);
            continue;
        }

        if (token === '(') {
            operatorStack.push(token);
            continue;
        }

        if (token === ')') {
            while (operatorStack.length && operatorStack[operatorStack.length - 1] !== '(') {
                outputQueue.push(operatorStack.pop());
            }
            if (operatorStack.length === 0 || operatorStack[operatorStack.length - 1] !== '(') {
                throw new Error('Mismatched parentheses');
            }
            operatorStack.pop(); // pop '('
            continue;
        }

        throw new Error('Invalid token in expression');
    }

    while (operatorStack.length) {
        const op = operatorStack.pop();
        if (op === '(' || op === ')') throw new Error('Mismatched parentheses');
        outputQueue.push(op);
    }

    // Evaluate RPN
    const stack = [];
    for (const token of outputQueue) {
        if (typeof token === 'number') {
            stack.push(token);
            continue;
        }
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

function updateActiveLineValue(el, lineStart, lineEnd, newLine) {
    const oldValue = el.value;
    const before = oldValue.slice(0, lineStart);
    const after = oldValue.slice(lineEnd);
    const newValue = before + newLine + after;

    isUpdating = true;
    el.value = newValue;
    // Place caret at end of replaced line
    const newCaret = (before + newLine).length;
    if (typeof el.selectionStart === 'number') {
        el.selectionStart = el.selectionEnd = newCaret;
    }
    isUpdating = false;
}

// Accessibility live region
const liveRegion = document.createElement('div');
liveRegion.setAttribute('aria-live', 'polite');
liveRegion.style.position = 'absolute';
liveRegion.style.left = '-9999px';
document.documentElement.appendChild(liveRegion);

// Main listener
const onInput = debounce(function (event) {
    if (isUpdating) return;

    const target = event.target;
    const tagName = target?.tagName;
    if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') return;

    const value = target.value ?? '';
    const caret = typeof target.selectionStart === 'number' ? target.selectionStart : value.length;
    const { start, end } = getActiveLineBounds(value, caret);
    const line = value.slice(start, end);

    // Only proceed if line matches the trigger pattern (ends with '=  ')
    const parsed = parseEquation(line);
    if (!parsed) return;

    const result = evaluateExpression(parsed.expression);

    // Reconstruct the new line preserving everything before the last '=',
    // replacing only the trailing expression and adding " = result "
    let beforeExpr = parsed.leftPart;
    if (beforeExpr) {
        // Normalize spacing around the preserved '=' for readability
        // Convert like "...=something" or "... = something" to "... = "
        beforeExpr = beforeExpr.replace(/\s*=\s*$/, ' = ');
    }

    const newLine = `${beforeExpr || ''}${parsed.expression.trim()} = ${result} `;

    updateActiveLineValue(target, start, end, newLine);

    // Announce for screen readers
    liveRegion.textContent = newLine;
}, 300);

document.addEventListener('input', onInput);