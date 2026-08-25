const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const readManifest = (file) => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const chromeManifest = readManifest('manifest.json');
const firefoxManifest = readManifest('manifest.firefox.json');

describe('manifests', () => {
  it('both manifests declare the same version', () => {
    assert.match(chromeManifest.version, /^\d+\.\d+\.\d+$/);
    assert.equal(firefoxManifest.version, chromeManifest.version);
  });

  it('both manifests inject the content scripts in the same order', () => {
    const order = (m) => m.content_scripts.flatMap((cs) => cs.js);
    assert.deepEqual(order(chromeManifest), ['math.js', 'content.js']);
    assert.deepEqual(order(firefoxManifest), order(chromeManifest));
  });

  it('chrome manifest is MV3 with a service worker', () => {
    assert.equal(chromeManifest.manifest_version, 3);
    assert.equal(chromeManifest.background.service_worker, 'background.js');
  });

  it('firefox manifest is MV3 with a gecko id and background scripts', () => {
    assert.equal(firefoxManifest.manifest_version, 3);
    const gecko = firefoxManifest.browser_specific_settings?.gecko;
    assert.ok(gecko?.id, 'browser_specific_settings.gecko.id is required to install in Firefox');
    assert.match(gecko.id, /^[^@\s]+@[^@\s]+$/);
    assert.ok(gecko.strict_min_version, 'strict_min_version pins MV3 support (Firefox 128+)');
    assert.deepEqual(firefoxManifest.background.scripts, ['background.js']);
  });

  it('every file referenced by either manifest exists', () => {
    const referenced = new Set();
    for (const m of [chromeManifest, firefoxManifest]) {
      if (m.background?.service_worker) referenced.add(m.background.service_worker);
      for (const s of m.background?.scripts ?? []) referenced.add(s);
      for (const cs of m.content_scripts ?? []) {
        for (const js of cs.js) referenced.add(js);
      }
    }
    for (const file of referenced) {
      assert.ok(fs.existsSync(path.join(__dirname, file)), `${file} referenced in a manifest but missing`);
    }
  });
});
