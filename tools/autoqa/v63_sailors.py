import sys,time,json,subprocess,os,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-sailors';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
if (OUT/'results.json').exists():shutil.copy2(OUT/'results.json',OUT/('previous_'+time.strftime('%Y%m%d_%H%M%S')+'.json'))
http=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5210'],cwd=ROOT,stdout=(OUT/'http.log').open('w'),stderr=subprocess.STDOUT)
env=os.environ.copy();env['TIDEWATER_COOP_PORT']='5211';room=subprocess.Popen(['node','server/coopServer.js'],cwd=ROOT,env=env,stdout=(OUT/'room.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding']);pages=[]
  for i in range(2):
   page=browser.new_context(viewport={'width':1440,'height':900}).new_page();pages.append(page);page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:5210/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30&coop=1&room=127.0.0.1:5211',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  a,b=pages
  for p in pages:p.wait_for_function('window.__app.crew.peers.size===1&&window.__app.voyageM1.deckBody.ready&&[...window.__app.crew.peers.values()][0].sailorBody.ready',timeout=60000)
  a.evaluate("window.__stormwakeQA.go('boat')");a.wait_for_timeout(500);a.keyboard.press('v');a.wait_for_function('window.__app.voyageM1.deckBody.root.visible');a.screenshot(path=str(OUT/'local_third_person.png'));a.keyboard.down('w');b.wait_for_function("['walk','run','sprint'].includes([...window.__app.crew.peers.values()][0].activity)",timeout=3000);a.wait_for_timeout(400);a.keyboard.up('w');results['walk']=b.evaluate("(()=>{const p=[...window.__app.crew.peers.values()][0];return {activity:p.activity,clip:p.sailorBody.actor.rig.current,ready:p.sailorBody.ready,proceduralHidden:!p.captain.visible}})()");assert results['walk']['proceduralHidden'] and 'Walk' in results['walk']['clip']
  a.evaluate("window.__stormwakeQA.go('anchor')");a.wait_for_timeout(500);a.keyboard.press('e');a.wait_for_function("window.__app.player.stationId==='anchor'",timeout=7000);b.wait_for_timeout(1000)
  results['anchor']=b.evaluate('(()=>{const p=[...window.__app.crew.peers.values()][0];return {station:p.stationId,errors:p.sailorBody.handErrors,activity:p.activity}})()');assert len(results['anchor']['errors'])==2 and max(results['anchor']['errors'])<.05,results['anchor']
  b.evaluate("const a=window.__app,p=[...a.crew.peers.values()][0],t=p.root.position;a.setFreeCam(true);a.camera.position.set(t.x+2.7,t.y+2.2,t.z+3);const d={x:t.x-a.camera.position.x,y:t.y+1-a.camera.position.y,z:t.z-a.camera.position.z};a.fly.setPose(a.camera.position,Math.atan2(-d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z)))");b.wait_for_timeout(300);b.screenshot(path=str(OUT/'remote_real_capstan_grip.png'))
  a.keyboard.down('w');samples=[]
  for i in range(10):
   b.wait_for_timeout(100);samples.append(b.evaluate('(()=>{const p=[...window.__app.crew.peers.values()][0];return {errors:p.sailorBody.handErrors,diagnostics:p.sailorBody.handDiagnostics,feet:p.root.position,body:p.sailorBody.root.quaternion,boat:window.__app.boatCtl.quaternion,offset:p.sailorBody.feet.offset,crouch:p.sailorBody.crouchBlend,work:p.workAxis,station:p.stationId,activity:p.activity}})()'))
  a.keyboard.up('w');results['movingGrips']=samples;assert max(e for s in samples for e in s['errors'])<.05,samples
  a.keyboard.press('e');a.wait_for_function('!window.__app.player.stationId');a.evaluate("window.__stormwakeQA.go('boat');const p=window.__app.player;p.deckPos.set(-1.14,.89,1.0);p.deckYaw=0;p.pitch=-.4;p.deckToWorld()");a.wait_for_timeout(500);results['ammoTrace']=a.evaluate('window.__stormwakeQA.interactionTrace()');a.keyboard.press('e');a.wait_for_function("window.__app.voyageM1.heldAmmo==='cannonball'",timeout=6000);b.wait_for_function("[...window.__app.crew.peers.values()][0].activity==='carry'&&[...window.__app.crew.peers.values()][0].supply.ammo==='cannonball'",timeout=3000);results['carry']=True;a.keyboard.press('g');a.wait_for_function('!window.__app.voyageM1.heldAmmo');b.wait_for_function('window.__app.voyageM1.looseSupplies.byId.size===1');results['sharedDrop']=True;browser.close()
finally:
 http.terminate();room.terminate();http.wait(timeout=15);room.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 two real WebGPU sailors: local third-person body, remote authored walk, exact moving capstan skeleton grips, actual shared hand ammunition and physical drop PASS')
