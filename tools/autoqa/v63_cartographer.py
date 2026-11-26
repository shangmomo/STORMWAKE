import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-cartographer';OUT.mkdir(parents=True,exist_ok=True)
server=subprocess.Popen([sys.executable,'start_v60.py','--mode','solo','--no-browser','--port','5188'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT);errors=[];results={}
try:
 time.sleep(3)
 with sync_playwright() as p:
  b=p.chromium.launch(channel='msedge',headless=True);page=b.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5188/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  results['siteFloor']=page.evaluate('window.__app.terrainData.heightAt(130,760)');assert results['siteFloor'] < -6,results
  page.evaluate("window.__stormwakeQA.go('cabin');const p=window.__app.player;p.deckYaw=-Math.PI/2;p.pitch=-.7");page.wait_for_timeout(700)
  results['before']=page.evaluate('window.__stormwakeQA.interactionTrace()');page.keyboard.press('e');page.wait_for_timeout(500);results['phase']=page.evaluate('window.__app.voyageM1.cartographer.quest.phase');page.screenshot(path=str(OUT/'letter.png'));assert results['phase']=='accepted',results
  page.evaluate("window.__stormwakeQA.go('spawn');const p=window.__app.player;p.position.set(56,window.__app.terrainData.heightAt(56,-71),-71);window.__app.voyageM1.merchant.action('accept')")
  page.wait_for_function('!!window.__app.voyageM1.merchant.surface',timeout=45000)
  results['merchant']=page.evaluate('(()=>{const m=window.__app.voyageM1.merchant;return {floor:window.__app.terrainData.heightAt(270,920),deck:m.deckY,triangles:m.surface.world.stats,loadError:m.loadError}})()')
  assert results['merchant']['floor'] < -6,results
  page.evaluate("(()=>{const a=window.__app,m=a.voyageM1.merchant,p=a.player,s=m.quest.ship;const w=m.world({x:-3.85,y:-.45,z:0});p.mode='walk';p.stationId=null;p.position.set(w.x,w.y,w.z);p.velocity.set(0,0,0);p.grounded=true;p.waterMean=0;p.yaw=Math.atan2(-Math.cos(s.yaw),Math.sin(s.yaw));p.pitch=0;})()")
  page.keyboard.down('w')
  try:page.wait_for_function('(()=>{const a=window.__app,m=a.voyageM1.merchant,p=a.player;return m.surface.local(p.position).x>-.55&&p.position.y>m.quest.ship.y+m.deckY-.1})()',timeout=20000)
  finally:page.keyboard.up('w')
  results['boarding']=page.evaluate('({mode:window.__app.player.mode,local:window.__app.voyageM1.merchant.surface.local(window.__app.player.position)})');page.screenshot(path=str(OUT/'merchant_boarding.png'))
  results['quest']=page.evaluate('window.__app.voyageM1.cartographer.quest.serialize()');b.close()
finally:
 server.terminate();server.wait(timeout=10);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU letter interaction and submerged target terrain PASS')
