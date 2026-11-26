import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-deep';OUT.mkdir(parents=True,exist_ok=True);errors=[];results={}
server=subprocess.Popen([sys.executable,'start_v60.py','--mode','solo','--no-browser','--port','5189'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
  page.goto('http://127.0.0.1:5189/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.evaluate("const d=window.__app.voyageM1.deepEcho;d.quest.phase='prepared';d.load();window.__stormwakeQA.setHour(14);window.__app.settings.timeSpeed=0")
  page.wait_for_function('window.__app.voyageM1.deepEcho.ready',timeout=180000);results['assets']=True
  page.evaluate("window.__stormwakeQA.go('boat');const p=window.__app.player;p.deckPos.set(2.2,1,0);p.deckYaw=Math.PI/2;p.pitch=-.2;p.deckVel.set(0,0,0);p.deckToWorld()")
  page.wait_for_timeout(700);results['interaction']=page.evaluate('window.__stormwakeQA.interactionTrace()');page.keyboard.press('e');page.wait_for_function('window.__app.voyageM1.deepEcho.piloting',timeout=6000)
  page.wait_for_timeout(700);page.screenshot(path=str(OUT/'surface_cockpit.png'))
  page.evaluate('window.__app.boatCtl.teleportTo(-3250,5150,0)');page.wait_for_timeout(1200);page.keyboard.press('r');page.wait_for_function("window.__app.voyageM1.deepEcho.quest.phase==='diving'")
  before=page.evaluate('window.__app.voyageM1.deepEcho.quest.sub.y');page.keyboard.down('c');page.wait_for_timeout(1500);page.keyboard.up('c');after=page.evaluate('window.__app.voyageM1.deepEcho.quest.sub.y');results['keyboard_dive']={'before':before,'after':after};assert after<before-.4
  page.keyboard.press('g');page.wait_for_function('!window.__app.voyageM1.deepEcho.quest.pilot');room_before=page.evaluate('({...window.__app.voyageM1.deepEcho.quest.cabinPositions.local})');page.keyboard.down('s');page.wait_for_timeout(500);page.keyboard.up('s');room_after=page.evaluate('({...window.__app.voyageM1.deepEcho.quest.cabinPositions.local})');assert room_after['z']<room_before['z']-.1;results['cabin_walk']={'before':room_before,'after':room_after};page.keyboard.press('g');page.wait_for_function("window.__app.voyageM1.deepEcho.quest.pilot==='local'")
  page.evaluate("const d=window.__app.voyageM1.deepEcho;Object.assign(d.quest.sub,{x:-3180,y:-352,z:4900,speed:0,diveVelocity:0})");page.wait_for_timeout(2000)
  results['world']=page.evaluate('({motherVisible:window.__app.boat.group.visible,oldRaidActive:window.__app.hunt.abyss.active,cpuFloor:window.__app.terrainData.heightAt(-3180,4900),gpuFloor:window.__app.query.cpu[3],airPocket:window.__app.underwater.cabinAirDistance.value})');assert results['world']['motherVisible'] and not results['world']['oldRaidActive'];assert abs(results['world']['cpuFloor']-results['world']['gpuFloor'])<1
  page.keyboard.down('e');page.wait_for_function("window.__app.voyageM1.deepEcho.quest.phase==='return'",timeout=10000);page.keyboard.up('e');page.screenshot(path=str(OUT/'sample_cockpit.png'));results['sample']=page.evaluate('window.__app.voyageM1.deepEcho.quest.serialize()')
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},indent=2),encoding='utf-8')
assert not errors,errors[:4]
print('V63 real WebGPU: actual hatch E, real C dive, shared mother/world, CPU-GPU deep floor and held sample input PASS')
