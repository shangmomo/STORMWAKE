import sys,time,json,subprocess,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V64-sailing';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
if (OUT/'results.json').exists():shutil.copy2(OUT/'results.json',OUT/('previous_'+time.strftime('%Y%m%d_%H%M%S')+'.json'))
server=subprocess.Popen([sys.executable,'start_v64.py','--mode','solo','--no-browser','--port','5221'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding']);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5221/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  # Initial sea position, controlled weather and a stale full-throttle save
  # isolate sail/engine behaviour; subsequent chart click runs real crew/physics.
  page.evaluate("const a=window.__app,v=a.voyageM1,b=a.boatCtl;window.__stormwakeQA.go('boat');if(!b.teleportTo(800,1200,Math.atan2(-12,1)))throw Error('deep-water fixture rejected');b.moored=false;b.voyageAnchor=false;v.stations.anchorTravel=0;v.stations.anchorDown=false;v.stations.sailMain=0;v.stations.sailJib=0;v.stations.helmThrottle=1;b.throttle=1;b.throttleTarget=1;v.crew.active=true;a.player.deckToWorld()")
  page.wait_for_timeout(2500);results['furled']=page.evaluate('({thrust:window.__app.boatCtl.thrust,wind:window.__app.boatCtl.voyageSailForce,rpm:window.__app.boatCtl.rpm,main:window.__app.voyageM1.stations.sailMain,jib:window.__app.voyageM1.stations.sailJib})');assert abs(results['furled']['thrust'])<1e-6 and results['furled']['rpm']<1e-6 and results['furled']['main']==0,results
  page.evaluate("const a=window.__app,v=a.voyageM1,b=a.boatCtl;if(!b.teleportTo(800,1200,Math.atan2(-12,1)))throw Error('deep-water fixture rejected');b.moored=false;v.stations.anchorTravel=1;v.stations.anchorDown=true;v.stations.anchorManual=true;v.stations.sailMain=0;v.stations.sailJib=0;b.voyageAnchor=true;a.player.deckToWorld();a.oceanChart.open()")
  canvas=page.locator('.oc-map-wrap canvas');box=canvas.bounding_box();assert box
  page.mouse.click(box['x']+(660+4200)/6700*box['width'],box['y']+(1212+1100)/6900*box['height']);page.wait_for_function("window.__app.oceanChart.selectedWaypoint==='custom'&&!window.__app.oceanChart.opened")
  results['target']=page.evaluate('window.__app.oceanChart.getNavigationTarget()');samples=[]
  for i in range(180):
   page.wait_for_timeout(500);s=page.evaluate('(()=>{const a=window.__app,v=a.voyageM1,b=a.boatCtl,t=a.oceanChart.getNavigationTarget();return {phase:v.navigationPhase,anchor:v.stations.anchorTravel,main:v.stations.sailMain,jib:v.stations.sailJib,thrust:b.voyageSailForce,rpm:b.rpm,x:b.position.x,z:b.position.z,distance:Math.hypot(b.position.x-t.x,b.position.z-t.z),speed:b.speed,crew:[...v.crew.actors.values()].map(c=>({id:c.id,job:c.job,station:c.station,phase:c.phase,report:c.report}))}})()');samples.append(s)
   if i%10==0:print('navigation',i,s['phase'],round(s['distance'],1),round(s['anchor'],2),round(s['speed'],2),flush=True)
   if s['phase']=='stopping' and s['anchor']>.99 and s['main']<.04:break
  results['samples']=samples;assert any(.03<s['anchor']<.97 for s in samples),'capstan must really wind';assert any(s['main']>.7 and s['thrust']>1000 for s in samples),'sails must produce force';assert min(s['distance']for s in samples)<40,results['samples'][-1];assert samples[-1]['phase']=='stopping' and samples[-1]['anchor']>.99 and samples[-1]['main']<.04;assert all(s['rpm']<1e-6 for s in samples),'no hidden motor';page.screenshot(path=str(OUT/'navigation_arrival.png'))
  # Calm sea: raised cloth creates no forward drive from rest without wind.
  page.evaluate("const a=window.__app,v=a.voyageM1,b=a.boatCtl;a.oceanChart.clearNavigation();v.crew.active=false;const original=v.beforePhysics.bind(v);v.beforePhysics=dt=>{b.voyageWind.wind={x:0,z:0};original(dt)};b.voyageWind.wind={x:0,z:0};b.velocity.set(0,0,0);v.stations.sailMain=1;v.stations.sailJib=1;v.stations.anchorTravel=0;v.stations.anchorDown=false;b.voyageAnchor=false");page.wait_for_timeout(200);results['calm']=page.evaluate('({thrust:window.__app.boatCtl.voyageSailForce,rpm:window.__app.boatCtl.rpm})');assert abs(results['calm']['thrust'])<1e-5 and results['calm']['rpm']==0;browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V64 real chart click: crew walks to capstan and sail, mechanical raising, wind-powered navigation, arrival furling, furled/calm zero propulsion and no engine PASS')
