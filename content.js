let isUpdating = false;

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Line/trigger parsing lives in the MathEval module (math.js), which the
// manifest loads before this script, keeping that logic unit-testable.
const { getActiveLineBounds, parseEquation } = window.MathEval;

function evaluateExpression(rawExpression) {
    if (typeof window !== 'undefined' && window.MathEval && typeof window.MathEval.evaluateExpression === 'function') {
        return window.MathEval.evaluateExpression(rawExpression);
    }
    console.error('MathEval module not available');
    return 'Invalid expression';
}

// Only map capital X to '*'; leave other symbols unchanged
function normalizeExpression(expression) {
    if (typeof window !== 'undefined' && window.MathEval && typeof window.MathEval.normalizeExpression === 'function') {
        return window.MathEval.normalizeExpression(expression);
    }
    console.error('MathEval module not available');
    return expression;
}

// Shunting-yard parser with unary +/-, %, parentheses validation, and + - * /
function simpleParser(expression) {
    if (typeof window !== 'undefined' && window.MathEval && typeof window.MathEval.simpleParser === 'function') {
        return window.MathEval.simpleParser(expression);
    }
    console.error('MathEval module not available');
    return NaN;
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