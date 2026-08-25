# Inline Math Evaluator (Chrome Extension)

Auto-completes math equations while you type in `input` and `textarea` fields. When the current line ends with `= ` (equals followed by two spaces), it evaluates the expression on that line and replaces it inline with a single space around `=` plus one trailing space, placing the caret after that space.

- Only capital `X` is accepted for multiplication (by design, due to formatting constraints).
- Supports `+`, `-`, `*` (via `X`), `/`, parentheses, and unary plus/minus.
- Contextual percentages: `100 + 5%` → `105`, `200 - 10%` → `180`, `50 X 10%` → `5`. A standalone percentage (just `10%`) is currently rejected.
- Detects mismatched parentheses and invalid expressions.

## Install (Developer Mode)

1. Download or clone this folder locally.
2. Open Chrome and go to `chrome://extensions`.
3. Toggle on "Developer mode" (top-right).
4. Click "Load unpacked" and select this project folder.
5. The extension will appear in your extensions list.

## Usage

- In any website with a text field (`input` or `textarea`), type an expression on a line such as:
  - `5 X 3 =  ` → becomes `5 X 3 = 15 ␠` (caret moves to the end, after one trailing space)
  - `-(2 + 3) =  ` → becomes `-(2 + 3) = -5 ␠`
  - `2 + (-3) =  ` → becomes `2 + (-3) = -1 ␠`
- Multiple expressions in a single line are supported. The extension evaluates only the segment after the last `=` before the trigger and preserves earlier results. Example:
  - Type: `5 X 5 =  ` → becomes `5 X 5 = 25 ␠`
  - Continue typing: `X 4 =  ` on the same line → becomes `5 X 5 = 25 X 4 = 100 ␠`
- Trigger condition: the line must end with `= ` (exactly two spaces after `=`). Other triggers are ignored by design.

## Files

- `manifest.json`: Chrome Extension Manifest V3 configuration.
- `background.js`: Minimal background service worker (MV3), currently logs installation.
- `math.js`: The `MathEval` module — tokenizer, trigger/line parsing, shunting-yard parser, and evaluation. Used by the content script and covered by the unit tests.
- `content.js`: The content script that performs inline evaluation (delegates parsing and math to `math.js`).

## Constraints and Notes

- Multiplication: Only capital `X` works (e.g., `5 X 3`). Lowercase `x`, `×`, or `*` are not accepted as input; only `X` is recognized and internally mapped to `*` for evaluation.
- Percentage semantics: percentages are contextual in `+`/`-` (`50 + 10%` → `55`, `200 - 10%` → `180`) and act as plain fractions in multiplication and division (`50 X 10%` → `5`). A standalone percentage (e.g. just `10%`) currently evaluates to `Invalid expression`.
- Locales: No locale-specific number formatting.
- Targets: Works only on `input` and `textarea` fields (not `contenteditable`).
- Safety: Runs broadly on pages. If you need to restrict it, we can add host filters or input type checks.

## Troubleshooting

- If nothing happens, ensure the line ends with `=  ` and that your caret is on that line. The trigger needs **exactly two** trailing spaces — three or more spaces will not fire.
- If you see "Invalid expression", check for:
  - Mismatched parentheses
  - Disallowed characters
  - Divide by zero
  - A standalone percentage (e.g. a line that is just `10% =  `)
- Mismatched parentheses (e.g. `(5 + 3 =  `) currently produce no inline result at all; the error is logged to the page console (F12) instead.
- If you’re testing on `file://` pages, enable "Allow access to file URLs" for this extension in `chrome://extensions`.

## Releases

Pushing a tag like `v1.0.1` triggers the Release workflow: the tests run, then the extension files are zipped with `manifest.json` at the zip root and attached to a GitHub Release as `inline-math-evaluator-v<version>.zip`.

```bash
git tag v1.0.1 && git push origin v1.0.1
```

To update your installed copy: download the zip from [Releases](../../releases), unzip it to a stable folder, then point the extension at it (or click "Reload" in `chrome://extensions` if you replaced files in place).

## Development

- Run the unit tests: `npm test` (Node's built-in test runner — Node 18 or newer, no dependencies). Tests live in `math.test.js` and cover the tokenizer, parser, evaluation, and trigger parsing.
- Edit `math.js` for evaluation/trigger logic, or `content.js` for field handling. Reload the extension via `chrome://extensions` → "Reload".
- Open DevTools (F12) on any page, check the Console for logs/errors from the content script.
- Background logs appear in `chrome://extensions` → click "service worker" link under this extension.

## License

MIT