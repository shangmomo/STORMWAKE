import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-posture';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5195'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5195/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.evaluate("window.__stormwakeQA.go('lower_entry')");page.wait_for_timeout(500);page.keyboard.press('e');page.wait_for_function("window.__app.player.deckLayer==='lowerHold'&&!window.__app.player.shipClimb")
  results['holdStart']=page.evaluate('window.__stormwakeQA.snapshot().player');page.keyboard.down('w');page.wait_for_timeout(600);page.keyboard.up('w');results['holdEnd']=page.evaluate('window.__stormwakeQA.snapshot().player');page.screenshot(path=str(OUT/'hold.png'))
  a=results['holdStart']['deckPosition'];b=results['holdEnd']['deckPosition'];assert ((a['x']-b['x'])**2+(a['z']-b['z'])**2)**.5>.15,results
  page.evaluate("window.__stormwakeQA.go('cabin_entry')");page.wait_for_timeout(500)
  if not page.evaluate('window.__app.boat.originalDoor.passable'):page.keyboard.press('e');page.wait_for_function('window.__app.boat.originalDoor.passable')
  for i in range(5):
   page.keyboard.press('e');page.wait_for_function("window.__app.player.deckLayer==='hold'&&!window.__app.player.shipClimb");page.keyboard.press('e');page.wait_for_function("window.__app.player.deckLayer==='deck'&&!window.__app.player.shipClimb",timeout=8000)
  results['cabinCycles']=5
  results['islet']=page.evaluate('({height:window.__app.terrainData.heightAt(-430,430),coast:window.__app.terrainData.heightAt(-430,475),floor:window.__app.terrainData.heightAt(-430,510)})');assert results['islet']['height']>8 and results['islet']['coast']<1 and results['islet']['floor']< -10
  for station in ['helm','anchor']:
   page.evaluate('(s)=>window.__stormwakeQA.go(s)',station);page.wait_for_timeout(500);page.keyboard.press('e');page.wait_for_function('(s)=>window.__app.player.stationId?.startsWith(s)',arg=station,timeout=6000);page.wait_for_timeout(500)
   results[station]=page.evaluate('({id:window.__app.player.stationId,handErrors:window.__app.voyageM1.stationHands.errors,visible:window.__app.voyageM1.stationHands.root.visible})');page.screenshot(path=str(OUT/(station+'.png')));assert results[station]['visible'] and len(results[station]['handErrors'])==2 and max(results[station]['handErrors'])<.05,results[station]
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU adult hold walking, five continuous cabin round trips and socket-bound helm/capstan hands PASS')
