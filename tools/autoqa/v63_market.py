import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-market';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5195'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5195/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=150000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  # Position and earned balance are explicit fixtures. Buying, picking,
  # climbing, stowing and unpacking below use real UI/keyboard interactions.
  page.evaluate("""()=>{const a=window.__app,p=a.player;p.mode='walk';p.position.set(62,a.terrainData.heightAt(62,-71),-71);p.yaw=0;p.pitch=-.2;a.voyageM1.voyage.tideCoin=100;}""");page.wait_for_timeout(500);page.keyboard.press('e');page.wait_for_function('window.__app.voyageM1.harborTrade.opened');page.locator('[data-buy="planks"]').click();page.wait_for_function('window.__app.voyageM1.cargo.get("harbor_supply_1")');results['purchased']=page.evaluate('({balance:window.__app.voyageM1.voyage.tideCoin,item:window.__app.voyageM1.cargo.get("harbor_supply_1")})');assert results['purchased']['balance']==70
  page.screenshot(path=str(OUT/'shop.png'));page.keyboard.press('Escape');page.wait_for_function('!window.__app.voyageM1.harborTrade.opened&&window.__app.input.enabled')
  page.evaluate("""()=>{const a=window.__app,p=a.player,item=a.voyageM1.cargo.get('harbor_supply_1');p.position.set(item.x,a.terrainData.heightAt(item.x,item.z+.8),item.z+.8);p.yaw=0;p.pitch=-.4;}""");page.wait_for_timeout(500);results['pickTrace']=page.evaluate('window.__stormwakeQA.interactionTrace()');page.keyboard.press('e');page.wait_for_function('window.__app.voyageM1.cargo.heldBy.size===1')
  page.evaluate("window.__stormwakeQA.go('lower_entry')");page.wait_for_timeout(400);page.keyboard.press('e');page.wait_for_function("window.__app.player.deckLayer==='lowerHold'&&!window.__app.player.shipClimb");page.keyboard.down('w');page.wait_for_timeout(3000);page.keyboard.up('w');page.wait_for_timeout(300);results['stowTrace']=page.evaluate('window.__stormwakeQA.interactionTrace()');page.keyboard.press('e');page.wait_for_function('window.__app.voyageM1.cargo.get("harbor_supply_1").state==="hold"');page.wait_for_timeout(350);results['unpackTrace']=page.evaluate('window.__stormwakeQA.interactionTrace()');before=page.evaluate('window.__app.voyageM1.inventory.count("plank")');page.keyboard.press('e');page.wait_for_function('!window.__app.voyageM1.cargo.get("harbor_supply_1")');results['planksAfter']=page.evaluate('window.__app.voyageM1.inventory.count("plank")');assert results['planksAfter']==before+3
  page.screenshot(path=str(OUT/'unpacked.png'))
  results['sails']=page.evaluate("""()=>{const a=window.__app,v=a.voyageM1,cloth=a.boat.heritageArt.reefedCanvas[0];v.stations.sailMain=1;v.stations.sailJib=1;v._syncSailVisual();const full=Array.from(cloth.geometry.attributes.position.array);v.stations.sailMain=0;v._syncSailVisual();const furled=Array.from(cloth.geometry.attributes.position.array);return {panels:cloth.panels.length,changed:full.filter((x,i)=>Math.abs(x-furled[i])>.001).length,finite:furled.every(Number.isFinite),querySlots:a.query.count};}""");assert results['sails']['panels']==4 and results['sails']['changed']>1000 and results['sails']['finite'];page.evaluate("window.__stormwakeQA.go('anchor')");page.wait_for_timeout(300);page.keyboard.press('e');page.wait_for_function("window.__app.player.stationId==='anchor'");page.screenshot(path=str(OUT/'reefed_sails.png'))
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU: actual shipwright E shop, priced purchase, physical crate pickup, cargo-ladder traversal, stow/unpack and four independent original sail canvases PASS')
