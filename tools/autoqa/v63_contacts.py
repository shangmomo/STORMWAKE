import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-monster-contact';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5196'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5196/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.evaluate("const a=window.__app,b=a.hunt.bosses.get('squid');a.hunt.bosses.loadDetailed(b);a.boatCtl.teleportTo(1590,3010,0);window.__stormwakeQA.go('boat');window.__stormwakeQA.setHour(14);a.settings.timeSpeed=0")
  page.wait_for_function("window.__app.hunt.bosses.get('squid').detailReady",timeout=150000)
  page.evaluate("const owner=window.__app.hunt.bosses;window.__contactEvidence=[];const original=owner.applyConfirmedContact.bind(owner);owner.applyConfirmedContact=e=>{window.__contactEvidence.push({...e});return original(e)};owner.effects.release(owner.get('squid'),{kind:'grapple',sequence:991,radius:55,skill:'QA physical reach'})")
  page.wait_for_timeout(1700);results['farMiss']=page.evaluate('window.__contactEvidence');assert not results['farMiss'],'a distant physical grapple must miss'
  page.evaluate("const a=window.__app,o=a.hunt.bosses,b=o.get('squid');a.boatCtl.teleportTo(b.brain.x+13,b.brain.z,0);window.__stormwakeQA.go('boat');o.effects.release(b,{kind:'grapple',sequence:992,radius:55,skill:'QA actual hull contact'})")
  samples=[]
  for i in range(30):
   page.wait_for_timeout(100);samples.append(page.evaluate("(()=>{const b=window.__app.hunt.bosses.get('squid');return {grips:b.detailAsset.gripCount,arms:b.detailAsset.tentacles.map(t=>({id:t.armId,latched:t.latched,error:t.contactError,tip:{...t.actualTipWorld}})),events:window.__contactEvidence.length}})()"))
  assert max(s['grips'] for s in samples)<=6,'each physical hull grip slot must have only one arm';results['samples']=samples;results['contacts']=page.evaluate('window.__contactEvidence');page.screenshot(path=str(OUT/'near_grapple.png'));assert results['contacts'],'near grapple must reach actual triangles rather than remain a cosmetic effect'
  results['holes']=page.evaluate('window.__app.voyageM1.damage.hull.serialize().holes');assert results['holes'],'actual touch creates localized ship holes'
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real skinned kraken: distant grapple misses, near tentacles contact actual BVH and create localized hull damage PASS')
