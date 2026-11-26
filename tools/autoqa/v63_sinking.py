import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-sinking';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5191'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5191/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.evaluate("const a=window.__app;a.boatCtl.teleportTo(1590,3010,0);window.__stormwakeQA.go('boat');a.voyageM1.crew.update=()=>{};a.voyageM1.stations.inputs.clear();a.voyageM1.stations.sailMain=0;a.voyageM1.stations.sailJib=0;a.voyageM1.stations.helmThrottle=0");page.wait_for_timeout(3000)
  snapshot="(()=>{const a=window.__app,b=a.boatCtl,v=a.voyageM1;return {position:{...b.position},mass:b.mass,com:{...b.com},buoyancy:b.voyageBuoyancyScale,collapse:b.voyageFloodCollapse,mode:a.player.mode,water:v.damage.water,sunk:v.damage.sunk,cargo:v.cargo.serialize(),floor:a.terrainData.heightAt(b.position.x,b.position.z)}})()"
  results['dry']=page.evaluate(snapshot);page.evaluate('window.__app.voyageM1.damage.water=.4');page.wait_for_timeout(5000);results['flooded']=page.evaluate(snapshot);assert results['flooded']['mass']>results['dry']['mass']*1.18;assert results['flooded']['buoyancy']<.8
  # Controlled damage and pre-stowed cargo are fixtures; sinking, buoyancy,
  # player release and floating cargo are the real running game simulation.
  page.evaluate("const v=window.__app.voyageM1;v.cargo.spawnChest('qa_sink',{x:0,y:0,z:0});v.cargo.tryPick('fixture','qa_sink');v.cargo.tryStow('fixture','stormwake',{x:1,y:-.5,z:-3});v.damage.water=.98;v.damage.sunk=true");page.wait_for_timeout(18000);results['sunk']=page.evaluate(snapshot);assert results['sunk']['position']['y']<results['dry']['position']['y']-.7,results;assert results['sunk']['mode']=='swim',results['sunk'];item=next(i for i in results['sunk']['cargo'] if i['id']=='qa_sink');assert item['state']=='world' and item['floating'] and not item['onDeck'];page.screenshot(path=str(OUT/'abandoned_ship.png'))
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU: dry hull baseline, flooded mass/centre/buoyancy, physical sinking, sailor swimming release and actual floating cargo PASS')
