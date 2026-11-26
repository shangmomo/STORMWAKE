import sys,time,json,subprocess,os
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-four-connect';OUT.mkdir(parents=True,exist_ok=True);results=[];errors=[]
http=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5197'],cwd=ROOT,stdout=(OUT/'http.log').open('w'),stderr=subprocess.STDOUT)
env=os.environ.copy();env['TIDEWATER_COOP_PORT']='5198';room=subprocess.Popen(['node','server/coopServer.js'],cwd=ROOT,env=env,stdout=(OUT/'room.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']);pages=[]
  for i in range(4):
   context=browser.new_context(viewport={'width':1200,'height':800});page=context.new_page();pages.append(page);page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:5197/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=20&coop=1&room=127.0.0.1:5198',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'");page.wait_for_timeout(1000)
   states=[p.evaluate('({connected:window.__app.crew.connected,status:window.__app.crew.status,id:window.__app.crew.selfId,peers:window.__app.crew.peers.size,socket:window.__app.crew.socket?.readyState,position:{...window.__app.player.position},yaw:window.__app.player.yaw})') for p in pages]
   server=json.load(urlopen('http://127.0.0.1:5198/api/crew/status'));results.append({'joined':i+1,'clients':states,'server':server});print(json.dumps(results[-1],ensure_ascii=True),flush=True)
  for p in pages:p.wait_for_function('window.__app.crew.peers.size===3',timeout=15000)
  for index,p in enumerate(pages):
   station=["anchor","anchor_2","anchor_3","anchor_4"][index];p.evaluate("s=>window.__stormwakeQA.go(s)",station);p.wait_for_timeout(500);results.append({'stationBefore':p.evaluate('window.__stormwakeQA.interactionTrace()')});p.keyboard.press('e');p.wait_for_function("window.__app.player.stationId?.startsWith('anchor')",timeout=6000)
  seats=[p.evaluate('window.__app.player.stationId') for p in pages];assert len(set(seats))==4,seats;results.append({'seats':seats})
  browser.close()
finally:
 http.terminate();room.terminate();http.wait(timeout=15);room.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},indent=2),encoding='utf-8')
assert not errors,errors
print('V63 four real Edge/WebGPU clients: shared membership and four distinct reachable capstan seats PASS')
