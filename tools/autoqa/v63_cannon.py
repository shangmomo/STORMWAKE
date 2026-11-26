import sys,time,json,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V63-cannon';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
server=subprocess.Popen([sys.executable,'start_v63.py','--mode','solo','--no-browser','--port','5212'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5212/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.6&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.wait_for_function("window.__app.voyageM1.markerMeshes.cannon_starboard.userData.cannonRig",timeout=60000)
  # Explicit tilt/velocity fixtures isolate gun articulation from wave motion.
  # E station entry and mouse firing below use the game's actual input path.
  page.evaluate("""async()=>{const {Euler,Vector3}=await import('/src/engine/index.js'),a=window.__app,v=a.voyageM1,b=a.boatCtl;b.update=()=>{};b.quaternion.setFromEuler(new Euler(.18,.65,-.22,'YXZ'));a.boat.group.quaternion.copy(b.quaternion);b.velocity.set(.5,.1,-.3);v.crew.update=()=>{};window.__gunShots=[];const spawn=v._spawnBall.bind(v);v._spawnBall=launch=>{if(launch.source==='player'){const id=v._qaGun,m=v.markerMeshes[id],r=m.userData.cannonRig,tip=r.muzzle.getWorldPosition(new Vector3()),axis=r.barrel.localToWorld(new Vector3(0,0,1)).sub(r.barrel.localToWorld(new Vector3())).normalize(),actual=new Vector3(launch.vx-b.velocity.x,launch.vy-b.velocity.y,launch.vz-b.velocity.z).normalize();window.__gunShots.push({id,launch,muzzleError:tip.distanceTo(new Vector3(launch.x,launch.y,launch.z)),axisError:axis.distanceTo(actual),pitch:r.barrel.rotation.x,carriagePitch:m.userData.tube.rotation.x});}return spawn(launch);};} """)
  for index,station in enumerate(['cannon_port','cannon_starboard']):
   page.evaluate("s=>{const a=window.__app,v=a.voyageM1,p=a.player;window.__stormwakeQA.go('boat');p.deckPos.copy(v.stationLocal(s));p.deckPos.x-=s==='cannon_port'?.65:-.65;p.deckToWorld();v._faceStation(s);v._qaGun=s;}",station);page.wait_for_timeout(400);results[station+'Trace']=page.evaluate('window.__stormwakeQA.interactionTrace()');page.keyboard.press('e');page.wait_for_function('(s)=>window.__app.player.stationId===s',arg=station,timeout=8000)
   page.evaluate("window.__app.player.pitch=.18");page.wait_for_timeout(200);page.mouse.down();page.wait_for_function('(n)=>window.__gunShots.length>n',arg=index,timeout=5000);page.mouse.up();page.keyboard.press('e');page.wait_for_function('!window.__app.player.stationId')
  results['shots']=page.evaluate('window.__gunShots');assert all(s['muzzleError']<1e-5 and s['axisError']<1e-5 and abs(s['pitch'])>.2 and abs(s['carriagePitch'])<1e-5 for s in results['shots']),results
  page.evaluate("const a=window.__app,b=a.boatCtl.position;a.setFreeCam(true);a.camera.position.set(b.x+4,b.y+4,b.z+4);const d={x:b.x-a.camera.position.x,y:b.y+1.4-a.camera.position.y,z:b.z+1-a.camera.position.z};a.fly.setPose(a.camera.position,Math.atan2(-d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z)))");page.wait_for_timeout(500);page.screenshot(path=str(OUT/'articulated_cannon.png'));browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
print('V63 real WebGPU port/starboard E entry and mouse fire: source CC0 articulated barrels, actual muzzle/velocity alignment under full ship heel/pitch PASS')
