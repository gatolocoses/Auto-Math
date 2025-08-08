# Inline Math Evaluator (Chrome Extension)

Auto-completes math equations while you type in `input` and `textarea` fields. When the current line ends with `= ` (equals followed by two spaces), it evaluates the expression on that line and replaces it inline with a single space around `=` plus one trailing space, placing the caret after that space.

- Only capital `X` is accepted for multiplication (by design, due to formatting constraints).
- Supports `+`, `-`, `*` (via `X`), `/`, parentheses, unary plus/minus, and `%` as a literal (e.g., `10%` → `0.1`).
- Detects mismatched parentheses and invalid expressions.

## Install (Developer Mode)

### Chrome
1. Download or clone this folder locally.
2. Open Chrome and go to `chrome://extensions`.
3. Toggle on "Developer mode" (top-right).
4. Click "Load unpacked" and select this project folder.
5. The extension will appear in your extensions list.

### Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click "Load Temporary Add-on...".
3. Select the `firefox/manifest.json` file from this project.
4. The add-on will be installed temporarily until you restart Firefox.

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
- `content.js`: The content script that performs inline evaluation.

## Constraints and Notes

- Multiplication: Only capital `X` works (e.g., `5 X 3`). Lowercase `x`, `×`, or `*` are not accepted as input; only `X` is recognized and internally mapped to `*` for evaluation.
- Percentage semantics: Currently `10%` is interpreted as `0.1` (a literal). If you want "percent of previous term" semantics (e.g., `50 + 10%` → `55`), we can add that later.
- Locales: No locale-specific number formatting.
- Targets: Works only on `input` and `textarea` fields (not `contenteditable`).
- Safety: Runs broadly on pages. If you need to restrict it, we can add host filters or input type checks.

## Troubleshooting

- If nothing happens, ensure the line ends with `=  ` (equals followed by two spaces) and that your caret is on that line.
- If you see "Invalid expression", check for:
  - Mismatched parentheses
  - Disallowed characters
  - Divide by zero
- If you’re testing on `file://` pages, enable "Allow access to file URLs" for this extension in `chrome://extensions`.

## Development

- Edit `content.js` to adjust behavior. Reload the extension via `chrome://extensions` → "Reload".
- Open DevTools (F12) on any page, check the Console for logs/errors from the content script.
- Background logs appear in `chrome://extensions` → click "service worker" link under this extension.

## License

MIT