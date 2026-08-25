const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const MathEval = require('./math.js');

describe('tokenizeRaw', () => {
  it('tokenizes numbers, words, and capital X as an operator', () => {
    assert.deepEqual(MathEval.tokenizeRaw('5 kg X 2'), [
      { type: 'number', value: '5' },
      { type: 'ws', value: ' ' },
      { type: 'word', value: 'kg' },
      { type: 'ws', value: ' ' },
      { type: 'op', value: 'X' },
      { type: 'ws', value: ' ' },
      { type: 'number', value: '2' },
    ]);
  });

  it('keeps % attached to the preceding number', () => {
    assert.deepEqual(MathEval.tokenizeRaw('10%'), [{ type: 'number', value: '10%' }]);
  });

  it('tokenizes decimals', () => {
    assert.deepEqual(MathEval.tokenizeRaw('3.5'), [{ type: 'number', value: '3.5' }]);
  });

  it('silently drops unrecognized characters', () => {
    assert.deepEqual(MathEval.tokenizeRaw('5@#3'), [
      { type: 'number', value: '5' },
      { type: 'number', value: '3' },
    ]);
  });
});

describe('normalizeExpression', () => {
  it('maps capital X to *', () => {
    assert.equal(MathEval.normalizeExpression('5 X 3'), '5 * 3');
  });

  it('collapses whitespace and trims', () => {
    assert.equal(MathEval.normalizeExpression('  5   X   3  '), '5 * 3');
  });

  it('passes an already-normalized expression through', () => {
    assert.equal(MathEval.normalizeExpression('5 * 3'), '5 * 3');
  });

  it('allows % and parentheses', () => {
    assert.equal(MathEval.normalizeExpression('50 + (10% - 1)'), '50 + (10% - 1)');
  });

  it('rejects lowercase x', () => {
    assert.throws(() => MathEval.normalizeExpression('5 x 3'), /Invalid characters/);
  });

  it('rejects the × sign', () => {
    assert.throws(() => MathEval.normalizeExpression('5 × 3'), /Invalid characters/);
  });
});

describe('simpleParser', () => {
  it('respects * / over + - precedence', () => {
    assert.equal(MathEval.simpleParser('2 + 3 * 4'), 14);
  });

  it('evaluates parentheses first', () => {
    assert.equal(MathEval.simpleParser('(2 + 3) * 4'), 20);
  });

  it('applies left associativity to same-precedence operators', () => {
    assert.equal(MathEval.simpleParser('20 / 4 * 5'), 25);
  });

  it('supports unary minus', () => {
    assert.equal(MathEval.simpleParser('-5 + 3'), -2);
  });

  it('supports unary plus', () => {
    assert.equal(MathEval.simpleParser('+5 + 3'), 8);
  });

  it('supports unary minus after a binary operator', () => {
    assert.equal(MathEval.simpleParser('2 * -3'), -6);
  });

  it('folds repeated unary signs (current behavior)', () => {
    assert.equal(MathEval.simpleParser('--5'), 5);
  });

  it('rejects unclosed parentheses', () => {
    assert.throws(() => MathEval.simpleParser('(5 + 3'), /Mismatched parentheses/);
  });

  it('rejects unopened parentheses', () => {
    assert.throws(() => MathEval.simpleParser('5 + 3)'), /Mismatched parentheses/);
  });

  it('rejects implicit multiplication (current behavior)', () => {
    assert.throws(() => MathEval.simpleParser('2(3 + 4)'), /Invalid expression/);
  });

  it('returns NaN on division by zero', () => {
    assert.ok(Number.isNaN(MathEval.simpleParser('5 / 0')));
  });

  it('applies percent to the other operand in addition', () => {
    assert.equal(MathEval.simpleParser('100 + 5%'), 105);
  });

  it('applies percent to the other operand in subtraction', () => {
    assert.equal(MathEval.simpleParser('200 - 10%'), 180);
  });

  it('treats percent as a plain fraction in multiplication', () => {
    assert.equal(MathEval.simpleParser('50 * 10%'), 5);
  });

  it('treats percent as a plain fraction in division', () => {
    assert.equal(MathEval.simpleParser('50 / 50%'), 100);
  });

  it('returns a raw percent token for a standalone percent (current behavior)', () => {
    assert.deepEqual(MathEval.simpleParser('10%'), { type: 'percent', value: 0.1 });
  });
});

describe('evaluateExpression', () => {
  it('evaluates a basic multiplication', () => {
    assert.equal(MathEval.evaluateExpression('5 X 5'), '25');
  });

  it('evaluates division to a decimal', () => {
    assert.equal(MathEval.evaluateExpression('10 / 4'), '2.5');
  });

  it('rounds away floating point noise', () => {
    assert.equal(MathEval.evaluateExpression('0.1 + 0.2'), '0.3');
  });

  it('keeps 8 decimal places of precision', () => {
    assert.equal(MathEval.evaluateExpression('1 / 3'), '0.33333333');
  });

  it('passes through a unit word following the first number', () => {
    assert.equal(MathEval.evaluateExpression('5 kg X 2'), '10 kg');
  });

  it('only detects a unit immediately after the first number', () => {
    assert.equal(MathEval.evaluateExpression('5 + 3 kg'), '8');
  });

  it('drops word tokens other than the leading unit', () => {
    assert.equal(MathEval.evaluateExpression('5 m + 3 m'), '8 m');
  });

  it('returns Invalid expression for empty input', () => {
    assert.equal(MathEval.evaluateExpression(''), 'Invalid expression');
  });

  it('returns Invalid expression for input without numbers', () => {
    assert.equal(MathEval.evaluateExpression('abc'), 'Invalid expression');
  });

  it('returns Invalid expression for division by zero', () => {
    assert.equal(MathEval.evaluateExpression('5 / 0'), 'Invalid expression');
  });

  it('rejects a standalone percent (current behavior, see README)', () => {
    assert.equal(MathEval.evaluateExpression('10%'), 'Invalid expression');
  });

  it('propagates mismatched-parenthesis errors instead of returning a string', () => {
    assert.throws(() => MathEval.evaluateExpression('(5 + 3'), /Mismatched parentheses/);
  });
});

describe('getActiveLineBounds', () => {
  it('returns the middle line for a caret inside it', () => {
    assert.deepEqual(MathEval.getActiveLineBounds('ab\ncd\nef', 4), { start: 3, end: 5 });
  });

  it('returns the first line for a caret inside it', () => {
    assert.deepEqual(MathEval.getActiveLineBounds('ab\ncd', 1), { start: 0, end: 2 });
  });

  it('returns the last line for a caret at the very end', () => {
    assert.deepEqual(MathEval.getActiveLineBounds('ab\ncd', 5), { start: 3, end: 5 });
  });

  it('handles single-line input with caret at start', () => {
    assert.deepEqual(MathEval.getActiveLineBounds('ab', 0), { start: 0, end: 2 });
  });
});

describe('parseEquation', () => {
  it('parses a line ending with the two-space trigger', () => {
    assert.deepEqual(MathEval.parseEquation('5 X 5 =  '), {
      expression: '5 X 5',
      leftPart: '',
      exprSegmentOriginal: '5 X 5',
    });
  });

  it('rejects three or more trailing spaces (exactly two required)', () => {
    assert.equal(MathEval.parseEquation('5 X 5 =   '), null);
  });

  it('rejects a single trailing space', () => {
    assert.equal(MathEval.parseEquation('5 X 5 = '), null);
  });

  it('rejects a line with no trailing space', () => {
    assert.equal(MathEval.parseEquation('5 X 5 ='), null);
  });

  it('evaluates only the segment after the last = when chaining', () => {
    assert.deepEqual(MathEval.parseEquation('5 X 5 = 25 X 4 =  '), {
      expression: '25 X 4',
      leftPart: '5 X 5 =',
      exprSegmentOriginal: ' 25 X 4',
    });
  });

  it('rejects an empty expression', () => {
    assert.equal(MathEval.parseEquation('=  '), null);
  });

  it('rejects an expression without any digit', () => {
    assert.equal(MathEval.parseEquation('hello =  '), null);
  });

  it('parses an expression directly after = with no space', () => {
    assert.deepEqual(MathEval.parseEquation('5=  '), {
      expression: '5',
      leftPart: '',
      exprSegmentOriginal: '5',
    });
  });
});
