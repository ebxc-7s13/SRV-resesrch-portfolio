const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function fixture({ stored = null, blocked = false } = {}) {
  const values = new Map(stored === null ? [] : [['accent-color', stored]]);
  const window = new EventTarget();
  const document = { documentElement: { dataset: {} } };
  const localStorage = {
    getItem: key => { if (blocked) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem: (key, value) => { if (blocked) throw new Error('Storage denied'); values.set(key,value); },
  };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = cache[name] = {};
    const source = fs.readFileSync(`${__dirname}/../src/lib/${name}.ts`,'utf8');
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,
      {exports,window,document,localStorage,Event,require: id => id === 'react' ? {} : load(id.replace('./',''))});
    return exports;
  }
  return { api: load('accent-color'), palettes: load('accent-palette'), values, window, document, localStorage };
}

test('Accent selection validates stored preferences and defaults safely', () => {
  for (const color of ['green','blue','red']) assert.equal(fixture({stored:color}).api.getAccentColor(),color);
  for (const options of [{},{stored:'purple'},{blocked:true}]) assert.equal(fixture(options).api.getAccentColor(),'green');
});

test('Cycling applies the root palette and persists green, blue, red in order', () => {
  const f = fixture();
  for (const expected of ['blue','red','green']) {
    f.api.cycleAccentColor();
    assert.equal(f.api.getAccentColor(),expected);
    assert.equal(f.document.documentElement.dataset.accent,expected);
    assert.equal(f.values.get('accent-color'),expected);
  }
});

test('Blocked storage still allows in-memory color changes', () => {
  const f = fixture({blocked:true});
  f.api.cycleAccentColor();
  assert.equal(f.api.getAccentColor(),'blue');
  assert.equal(f.document.documentElement.dataset.accent,'blue');
});

test('Storage events synchronize active subscribers and clean up correctly', () => {
  const f = fixture(); let first = 0, second = 0;
  const unsubscribe = f.api.subscribeAccentColor(()=>first++);
  const other = f.api.subscribeAccentColor(()=>second++);
  unsubscribe();
  f.values.set('accent-color','red');
  const event = new Event('storage'); Object.defineProperties(event,{key:{value:'accent-color'},storageArea:{value:f.localStorage}});
  f.window.dispatchEvent(event);
  assert.equal(f.api.getAccentColor(),'red');
  assert.equal(f.document.documentElement.dataset.accent,'red');
  assert.equal(first,0); assert.equal(second,1);
  other(); f.api.setAccentColor('blue'); assert.equal(second,1);
});

test('Bootstrap restores the saved palette before hydration even when storage is blocked', () => {
  for (const options of [{stored:'blue'},{stored:'red'},{stored:'invalid'},{blocked:true}]) {
    const f = fixture(options);
    vm.runInNewContext(f.palettes.ACCENT_BOOTSTRAP_SCRIPT,{document:f.document,localStorage:f.localStorage});
    assert.equal(f.document.documentElement.dataset.accent,['blue','red'].includes(options.stored)?options.stored:'green');
  }
});

test('Palette text pairs meet normal text contrast on dark, filled, and light surfaces', () => {
  const {palettes} = fixture();
  const luminance = rgb => rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const contrast = (a,b) => {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
  for (const palette of Object.values(palettes.ACCENT_PALETTES)) {
    assert.ok(contrast(palette.text,[17,20,23])>=7,'Readable accent on dark panels');
    assert.ok(contrast(palette.onFill,palette.fill)>=4.5,'Readable text on deep accent fills');
    assert.ok(contrast(palette.onLight,[230,232,233])>=4.5,'Readable accent on light cards');
  }
});

test('Runtime CSS palettes match the contrast-tested colors', () => {
  const { palettes } = fixture();
  const css = fs.readFileSync(`${__dirname}/../src/app/accent-colors.css`, 'utf8');
  for (const [color, palette] of Object.entries(palettes.ACCENT_PALETTES)) {
    const selector = color === 'green' ? ':root' : `html[data-accent="${color}"]`;
    const block = css.slice(css.indexOf(selector)).split('}')[0];
    for (const [role, channels] of Object.entries({ accent: palette.text, 'accent-fill': palette.fill, 'on-accent': palette.onFill, 'accent-on-light': palette.onLight })) {
      assert.ok(block.includes(`--${role}: ${channels.join(' ')};`), `${color} ${role} matches the verified palette`);
    }
  }
});

test('Unrelated storage changes are ignored and clearing storage restores green', () => {
  const f = fixture({ stored: 'blue' });
  let calls = 0;
  const unsubscribe = f.api.subscribeAccentColor(() => calls++);
  const send = (key, storageArea = f.localStorage) => {
    const event = new Event('storage');
    Object.defineProperties(event, { key: { value: key }, storageArea: { value: storageArea } });
    f.window.dispatchEvent(event);
  };
  f.values.set('accent-color', 'red');
  send('unrelated'); send('accent-color', {});
  assert.equal(f.api.getAccentColor(), 'blue');
  assert.equal(calls, 0);
  f.values.clear(); send(null);
  assert.equal(f.api.getAccentColor(), 'green');
  assert.equal(calls, 1);
  unsubscribe();
});
