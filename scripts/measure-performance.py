"""Production browser probe: python scripts/measure-performance.py before|after."""
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

OUT = Path('.qa/performance')
OUT.mkdir(parents=True, exist_ok=True)
label = sys.argv[1] if len(sys.argv) > 1 else 'after'
BASE = 'http://127.0.0.1:3000'
INIT = """(() => {
  window.probe = {long: [], gl: [], events: []};
  new PerformanceObserver(l => probe.long.push(...l.getEntries().map(e => ({start:e.startTime, duration:e.duration})))).observe({type:'longtask',buffered:true});
  new PerformanceObserver(l => probe.events.push(...l.getEntries().map(e => ({name:e.name,duration:e.duration,delay:e.processingStart-e.startTime})))).observe({type:'event',buffered:true,durationThreshold:16});
  const original = HTMLCanvasElement.prototype.getContext;
  const seen = new WeakSet();
  HTMLCanvasElement.prototype.getContext = function(type,...args) {
    const start=performance.now(), result=original.call(this,type,...args);
    if (/webgl/.test(type) && result && !seen.has(this)) { seen.add(this); probe.gl.push({type,duration:performance.now()-start}); }
    return result;
  };
})();"""
METRICS = """() => {
 const n=performance.getEntriesByType('navigation')[0];
 const r=performance.getEntriesByType('resource');
 return {...probe,ttfb:n.responseStart,dom:n.domContentLoadedEventEnd,
 paint:performance.getEntriesByType('paint').map(e=>({name:e.name,start:e.startTime})),
 jsBytes:r.filter(e=>e.name.includes('.js')).reduce((a,e)=>a+e.encodedBodySize,0),
 canvases:document.querySelectorAll('canvas').length,
 resources:r.map(e=>({url:e.name.replace(location.origin,''),bytes:e.encodedBodySize,duration:e.duration}))};
}"""
result = {'loads': [], 'errors': [], 'navigation': []}
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True)
    for i in range(3):
        context = browser.new_context(viewport={'width':1440,'height':900})
        context.add_init_script(INIT)
        page = context.new_page()
        page.on('pageerror', lambda e: result['errors'].append(str(e)))
        page.goto(BASE, wait_until='networkidle')
        assert page.get_by_role('button', name='Try Again', exact=True).count() == 0
        page.locator('.vanta-cells canvas').wait_for(timeout=20000) if page.locator('.vanta-cells').count() else None
        result['loads'].append(page.evaluate(METRICS))
        if i == 0:
            page.screenshot(path=str(OUT / f'{label}-home.png'))
            result['buttons'] = page.locator('button').evaluate_all('(els)=>els.map(e=>({text:e.textContent,label:e.getAttribute("aria-label")}))')
            page.get_by_role('button', name='Open Cells settings', exact=True).click()
            page.get_by_role('dialog').wait_for()
            before = page.evaluate('probe.gl.length')
            page.get_by_role('slider', name='Speed', exact=True).fill('1.5')
            page.wait_for_timeout(400)
            result['sliderContexts'] = page.evaluate('probe.gl.length') - before
            page.get_by_role('button', name='Close settings', exact=True).click()
            start = page.evaluate('performance.now()')
            page.get_by_role('link', name='RESEARCH', exact=True).click()
            page.wait_for_url('**/research')
            page.locator('h1').wait_for()
            result['navigationMs'] = page.evaluate('performance.now()')-start
        context.close()
    for i in range(3):
        context = browser.new_context(viewport={'width':1440,'height':900})
        page = context.new_page()
        page.goto(BASE + '/contact', wait_until='networkidle')
        cdp = context.new_cdp_session(page)
        cdp.send('Network.enable')
        cdp.send('Network.emulateNetworkConditions', {'offline':False,'latency':150,'downloadThroughput':1250000,'uploadThroughput':625000})
        requests = []
        page.on('request', lambda req: requests.append({'url':req.url,'at':page.evaluate('performance.now()')}))
        link = page.get_by_role('link', name='RESEARCH', exact=True)
        link.hover()
        # Fixed think time models a user hovering before committing to a link.
        page.wait_for_timeout(700)
        start = page.evaluate('performance.now()')
        link.click()
        page.wait_for_url('**/research')
        page.locator('h1').wait_for()
        result['navigation'].append({'ms':page.evaluate('performance.now()')-start,'routeRequestsAfterClick':sum('/research?' in r['url'] and r['at']>=start for r in requests)})
        context.close()
    browser.close()
(OUT / f'{label}.json').write_text(json.dumps(result, indent=2))
print(json.dumps({**{k:v for k,v in result.items() if k not in ['loads','buttons']}, 'loads':[{k:v for k,v in x.items() if k not in ['resources','events','long']} | {'longTasks':len(x['long']),'blockingMs':round(sum(max(0,e['duration']-50) for e in x['long']))} for x in result['loads']]}, indent=2), flush=True)
