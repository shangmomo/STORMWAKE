import sys,time,json,subprocess,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-stairs';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
if (OUT/'results.json').exists():shutil.copy2(OUT/'results.json',OUT/('previous_'+time.strftime('%Y%m%d_%H%M%S')+'.json'))
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5213'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5213/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  def wait_route(expression,route):
   try:page.wait_for_function(expression,arg=route,timeout=5000)
   except Exception:
    page.keyboard.up('w');page.keyboard.up('s');results['failure']=page.evaluate('({snapshot:window.__stormwakeQA.snapshot(),contacts:window.__app.player.collisionContacts,velocity:window.__app.player.deckVel,yaw:window.__app.player.deckYaw})');page.screenshot(path=str(OUT/'failure.png'));raise
  # Only the initial approach is placed. Each flight then runs twenty complete
  # up/down cycles through real W/S inputs without position resets or E climbs.
  for route in ['aft','fore']:
   page.evaluate('(r)=>window.__stormwakeQA.go(r+"_stairs")',route);page.wait_for_timeout(500);samples=[];results[route]=samples
   for cycle in range(20):
    page.keyboard.down('w')
    wait_route("r=>{const p=window.__app.player.deckPos;return r==='aft'?p.z< -7.34&&p.y>1.75:p.z>3.73&&p.y>1.68}",route);page.keyboard.up('w');page.wait_for_timeout(150)
    up=page.evaluate('window.__stormwakeQA.snapshot().player');assert up['mode']=='deck' and not up['climbing'],up
    page.keyboard.down('s');wait_route("r=>{const p=window.__app.player.deckPos;return r==='aft'?p.z> -5.34&&p.y<1.15:p.z<1.65&&p.y<1.05}",route);page.keyboard.up('s');page.wait_for_timeout(150)
    down=page.evaluate('window.__stormwakeQA.snapshot().player');assert down['mode']=='deck' and not down['climbing'],down;samples.append({'cycle':cycle+1,'up':up['deckPosition'],'down':down['deckPosition']})
   page.screenshot(path=str(OUT/(route+'_20_cycles.png')))
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU adult fore/aft stairs: 20 uninterrupted up/down cycles each, actual W/S walking, no E climbing or between-cycle position resets PASS')
