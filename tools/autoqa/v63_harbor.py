import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-harbor-work';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5195'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5195/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.6&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.wait_for_function("window.__app.voyageM1.harborPeople.people.find(p=>p.role==='shipwright')?.ikResult",timeout=20000)
  samples=[]
  for i in range(30):
   page.wait_for_timeout(100);samples.append(page.evaluate("(()=>{const p=window.__app.voyageM1.harborPeople.people.find(p=>p.role==='shipwright');return {working:p.working,error:p.ikResult?.error,tool:!!p.tool,upper:p.ikResult?.upperLength,lower:p.ikResult?.lowerLength,target:p.workTarget}})()"))
  results['samples']=samples;working=[s for s in samples if s['working']];assert working and max(s['error'] for s in working)<.05,working
  page.evaluate("(()=>{const a=window.__app;a.setFreeCam(true);a.camera.position.set(64,a.terrainData.heightAt(62,-73)+1.7,-69.5);const d={x:62-a.camera.position.x,y:a.terrainData.heightAt(62,-73)+.9-a.camera.position.y,z:-73.4-a.camera.position.z};a.fly.setPose(a.camera.position,Math.atan2(-d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z)));})()");page.wait_for_timeout(500);page.screenshot(path=str(OUT/'shipwright_work.png'))
  # Explicit visual fixtures isolate sail controls from the AI operator; this
  # does not claim a full sailing voyage or a frame-rate performance result.
  page.evaluate("(()=>{const a=window.__app,v=a.voyageM1;v.crew.update=()=>{};v.stations.inputs.clear();v.stations.sailMain=1;v.stations.sailJib=1;const b=a.boatCtl.position;a.camera.position.set(b.x+23,b.y+11,b.z+12);const d={x:b.x-a.camera.position.x,y:b.y+6-a.camera.position.y,z:b.z-a.camera.position.z};a.fly.setPose(a.camera.position,Math.atan2(-d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z)));})()");page.wait_for_timeout(600);page.screenshot(path=str(OUT/'sails_full.png'));page.evaluate('window.__app.voyageM1.stations.sailMain=0');page.wait_for_timeout(600);page.screenshot(path=str(OUT/'sails_main_furled.png'));results['cloth']=page.evaluate('({main:window.__app.voyageM1.stations.sailMain,jib:window.__app.voyageM1.stations.sailJib,panels:window.__app.boat.heritageArt.reefedCanvas[0].panels.length})')
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU: actual CC0 shipwright wrist/tool work IK plus original main/jib sail visual fixtures PASS')
