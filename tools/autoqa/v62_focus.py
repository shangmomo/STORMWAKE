"""V62 real Edge/WebGPU stairs, physical anchor and offshore shader inspection."""
import sys,json,time,subprocess
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa'/'V62-focus'/datetime.now().strftime('%Y%m%d_%H%M%S');OUT.mkdir(parents=True,exist_ok=True)
log=(OUT/'server.log').open('w',encoding='utf-8');server=subprocess.Popen([sys.executable,'-u','start_v60.py','--no-browser','--port','5187','--mode','solo'],cwd=ROOT,stdout=log,stderr=subprocess.STDOUT)
errors=[];results=[]
try:
 time.sleep(3)
 with sync_playwright() as p:
  browser=p.chromium.launch(channel='msedge',headless=True,args=['--enable-unsafe-webgpu'])
  page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:print(m.type,m.text[:1000],flush=True) if m.type in ['warning','error'] else None);page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto('http://127.0.0.1:5187/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded')
  page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  for name,upper,lower in ([] if '--visual-only' in sys.argv else [('aft_stairs',-7.35,-5.25),('fore_stairs',3.75,1.61)]):
   page.evaluate('(n)=>window.__stormwakeQA.go(n)',name);page.wait_for_timeout(500)
   samples=[]
   for cycle in range(20):
    if cycle%5==0:print(name,'cycle',cycle,flush=True)
    for reverse in [False,True]:
     # Only change heading between passes. Real W carries the actual capsule;
     # positions are NEVER reset within the 20 consecutive round trips.
     sign=(-1 if name=='aft_stairs' else 1)*(-1 if reverse else 1);target=lower if reverse else upper
     page.evaluate('(sign)=>{const p=window.__app.player;p.deckYaw=sign>0?0:Math.PI;p.deckVel.set(0,0,0)}',sign)
     page.keyboard.down('w')
     try:page.wait_for_function('({sign,target})=>(window.__app.player.deckPos.z-target)*sign>=0',arg={'sign':sign,'target':target},timeout=15000)
     except Exception:
      results.append({'failure':name,'cycle':cycle,'reverse':reverse,'snapshot':page.evaluate('window.__stormwakeQA.snapshot()')});page.screenshot(path=str(OUT/'stairs_failure.png'));raise
     finally:page.keyboard.up('w')
     samples.append(page.evaluate('({position:{...window.__app.player.deckPos},mode:window.__app.player.mode})'))
     if samples[-1]['mode']!='deck':raise AssertionError('fell from staircase')
   results.append({'test':name,'roundTrips':20,'samples':samples});print(name,'20 round trips PASS',flush=True)
   page.screenshot(path=str(OUT/(name+'.png')))
  page.evaluate('window.__stormwakeQA.setHour(14);window.__app.settings.timeSpeed=0')
  # Inspect the actual bow equipment from outside, retaining the game world.
  page.wait_for_function('!!window.__app.boat.heritageArt?.anchorRig',timeout=30000)
  def camera_at(x,y,z,tx,ty,tz):
   if z>1500:page.evaluate('(p)=>{const a=window.__app;const h=a.terrainData.heightAt(p[0],p[1]);if(h>=-8)throw Error("QA site is not deep water: "+h);a.boatCtl.teleportTo(p[0],p[1],0);}',[x,z])
   page.evaluate('''([x,y,z,tx,ty,tz])=>{const a=window.__app;a.setFreeCam(true);const dx=tx-x,dz=tz-z,dy=ty-y;a.fly.setPose(a.camera.position.clone().set(x,y,z),Math.atan2(-dx,-dz),Math.atan2(dy,Math.hypot(dx,dz)));a.fly.velocity.set(0,0,0);}''',[x,y,z,tx,ty,tz]);page.wait_for_timeout(2000)
  page.evaluate("window.__stormwakeQA.go('anchor')");page.wait_for_timeout(350);page.keyboard.press('e');page.wait_for_function("window.__app.player.stationId?.startsWith('anchor')");page.keyboard.down('w')
  try:page.wait_for_function('window.__app.voyageM1.stations.anchorTravel<=.0001',timeout=60000)
  finally:page.keyboard.up('w')
  page.keyboard.press('e');page.wait_for_timeout(300)
  b=page.evaluate('(()=>{const r=window.__app.boat.heritageArt.anchorRig;return {...r.carrier.getWorldPosition(r.carrier.position.clone())}})()');camera_at(b['x']+3,b['y']+.4,b['z']+2,b['x'],b['y']-.65,b['z'])
  page.screenshot(path=str(OUT/'bow_anchor.png'));results.append({'test':'anchor','rig':page.evaluate('({eye:window.__app.boat.heritageArt.anchorRig.eyeLocal,span:window.__app.boat.heritageArt.anchorRig.visibleSpan,chain:window.__app.boat.heritageArt.anchorRig.chainLength})')})
  for name,coords in [('ghost_storm',[-600,4,2620,-595,5,2550]),('waterspouts',[-380,95,4050,-520,120,3500])]:
   if name=='waterspouts':
    c=page.evaluate('({...window.__app.voyageM1.vortexVisuals.root.position})');coords=[c['x']+220,25,c['z']+220,c['x'],100,c['z']]
   camera_at(*coords);page.wait_for_timeout(7000);page.screenshot(path=str(OUT/(name+'.png')))
   results.append({'test':name,'weather':page.evaluate('window.__app.offshoreWeather'),'visibleCells':page.evaluate('window.__app.voyageM1.vortexVisuals.cells.filter(c=>c.visible).length')});print(name,'captured',flush=True)
  page.evaluate('window.__stormwakeQA.setHour(22)');page.wait_for_timeout(3000);page.screenshot(path=str(OUT/'waterspouts_night.png'))
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);log.close();(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
if errors:raise RuntimeError(str(errors[:5]))
