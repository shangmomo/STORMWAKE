import sys,time,json,subprocess,shutil,argparse
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/V64-walk';OUT.mkdir(parents=True,exist_ok=True);results={};errors=[]
parser=argparse.ArgumentParser();parser.add_argument('--case',default='all');args=parser.parse_args()
if args.case!='all':
 OUT=OUT.parent/(OUT.name+'-'+args.case);OUT.mkdir(parents=True,exist_ok=True)
if (OUT/'results.json').exists():shutil.copy2(OUT/'results.json',OUT/('previous_'+time.strftime('%Y%m%d_%H%M%S')+'.json'))
server=subprocess.Popen([sys.executable,'start_v64.py','--mode','solo','--no-browser','--port','5220'],cwd=ROOT,stdout=(OUT/'server.log').open('w'),stderr=subprocess.STDOUT)
try:
 time.sleep(3)
 with sync_playwright() as pw:
  browser=pw.chromium.launch(channel='msedge',headless=True,args=['--disable-background-timer-throttling','--disable-renderer-backgrounding']);page=browser.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:5220/?stormwake=1&heritageShip=1&qa=1&seed=61015&noAudio=1&scale=.5&maxFps=30',wait_until='domcontentloaded');page.wait_for_function('window.__stormwakeQA?.ready',timeout=180000);page.keyboard.press('Enter');page.wait_for_function("window.__app.playState==='playing'")
  page.wait_for_function('window.__app.voyageM1.deckBody.ready&&window.__app.voyageM1.crewVisuals.people.every(p=>p.body.ready)',timeout=60000)
  def snapshot():return page.evaluate('({player:window.__stormwakeQA.snapshot().player,contacts:window.__app.player.collisionContacts,velocity:window.__app.player.deckVel,climb:window.__app.player.shipClimb&&{t:window.__app.player.shipClimb.t,manual:window.__app.player.shipClimb.manual},mast:window.__app.player.mastClimb&&{y:window.__app.player.mastClimb.y,id:window.__app.player.mastClimb.mast?.id},trace:window.__stormwakeQA.interactionTrace()})')
  def hold(key,condition,timeout=6000):
   page.keyboard.down(key)
   try:page.wait_for_function(condition,timeout=timeout)
   finally:page.keyboard.up(key)
   page.wait_for_timeout(150)
  def run(name,fn):
   if args.case not in ['all',name]:return
   try:fn();results[name]={'pass':True,**results.get(name,{})};print(name,'PASS',flush=True)
   except Exception as e:
    for key in ['w','s','a','d']:page.keyboard.up(key)
    results[name]={'pass':False,'error':str(e),'state':snapshot()};page.screenshot(path=str(OUT/(name+'_failure.png')));print(name,'FAIL',str(e)[:100],flush=True)
  def front():
   page.evaluate("window.__stormwakeQA.go('boat');const a=window.__app,v=a.voyageM1;v.crew.active=false;const c=v.crew.getActor('ai:kael');c.yaw=0;c.station=null;c.phase='work';c.job='mid';a.setFreeCam(true)")
   for direction in [1,-1]:
    page.evaluate("d=>{const a=window.__app,p=a.voyageM1.crewVisuals.people[0].holder.getWorldPosition(a.camera.position.clone()),b=a.boatCtl;const cam=b.toWorld(a.voyageM1.crewVisuals.people[0].holder.position.clone().add({x:0,y:1.2,z:3*d}),a.camera.position);const v={x:p.x-cam.x,y:p.y+1.05-cam.y,z:p.z-cam.z};a.fly.setPose(cam,Math.atan2(-v.x,-v.z),Math.atan2(v.y,Math.hypot(v.x,v.z)))}",direction);page.wait_for_timeout(300);page.screenshot(path=str(OUT/('crew_front.png' if direction==1 else 'crew_back.png')))
   results['front']={'corrections':page.evaluate('window.__app.voyageM1.crewVisuals.people.map(p=>p.body.actor.forwardCorrection)')};assert results['front']['corrections']==[0,0,0]
   page.evaluate('window.__app.setFreeCam(false);window.__app.voyageM1.crew.active=true')
  run('front',front)
  def fore():
   page.evaluate("window.__stormwakeQA.go('boat');const p=window.__app.player;p.deckPos.set(1.03,1.85,3.9);p.deckYaw=0;p.pitch=0;p.deckVel.set(0,0,0);p.deckToWorld()")
   trail=[]
   for i in range(5):
    hold('w','window.__app.player.deckPos.z>6.55');trail.append(snapshot()['player']['deckPosition']);hold('s','window.__app.player.deckPos.z<3.95');trail.append(snapshot()['player']['deckPosition'])
   results['fore']={'cycles':5,'trail':trail};assert page.evaluate('!window.__app.game.prompt()&&!window.__app.game.rod.equipped');page.screenshot(path=str(OUT/'fore_return.png'))
  run('fore',fore)
  def cabin():
   page.evaluate("window.__stormwakeQA.go('cabin_entry')");page.wait_for_timeout(500)
   if not page.evaluate('window.__app.boat.originalDoor.passable'):page.keyboard.press('e');page.wait_for_function('window.__app.boat.originalDoor.passable')
   assert page.evaluate("!window.__app.player.shipClimb&&window.__app.player.deckLayer==='deck'")
   hold('w',"window.__app.player.deckPos.z< -7.60&&window.__app.player.deckLayer==='hold'",8000);inside=snapshot();page.screenshot(path=str(OUT/'cabin_inside.png'))
   hold('d','window.__app.player.deckPos.x> -.25',5000);hold('w','window.__app.player.deckPos.z< -8.15',5000);desk=snapshot();page.screenshot(path=str(OUT/'cabin_desk.png'))
   hold('a','window.__app.player.deckPos.x< -.85',5000);hold('s',"window.__app.player.deckPos.z> -6.30&&window.__app.player.deckLayer==='deck'",8000);results['cabin']={'inside':inside,'desk':desk,'outside':snapshot()}
  run('cabin',cabin)
  def hold_ladder():
   page.evaluate("window.__stormwakeQA.go('lower_entry');const p=window.__app.player;p.deckYaw=Math.atan2(-.9,-.32);p.pitch=-.6");page.wait_for_timeout(300);page.keyboard.down('s');page.wait_for_function('window.__app.player.shipClimb?.t>.2');page.keyboard.up('s');t=page.evaluate('window.__app.player.shipClimb.t');page.wait_for_timeout(500);page.keyboard.press('e');assert page.evaluate('!window.__app.player.stationId&&!!window.__app.player.shipClimb');assert abs(page.evaluate('window.__app.player.shipClimb.t')-t)<1e-6
   hold('s',"window.__app.player.deckLayer==='lowerHold'&&!window.__app.player.shipClimb",7000);page.evaluate('window.__app.player.deckYaw=Math.PI');hold('w',"window.__app.player.deckLayer==='deck'&&!window.__app.player.shipClimb",7000);results['hold']={'paused':t,'exit':snapshot()}
  run('hold',hold_ladder)
  def masts():
   states=[]
   for mid,z,top in [('main',-1.64,13),('fore',6.20,12.2)]:
    page.evaluate("async([z])=>{const a=window.__app,{deckHeight}=await import('/src/ship/HeritageDeck.js');window.__stormwakeQA.go('boat');const p=a.player;p.deckPos.set(0,deckHeight(z-.70,0),z-.70);p.deckYaw=0;p.pitch=0;p.deckVel.set(0,0,0);p.deckToWorld()}",[z]);page.wait_for_timeout(300)
    page.keyboard.down('w');page.wait_for_function('window.__app.player.mastClimb&&window.__app.player.mastClimb.y>4',timeout=6000);page.keyboard.up('w');y=page.evaluate('window.__app.player.deckPos.y');page.wait_for_timeout(500);assert abs(page.evaluate('window.__app.player.deckPos.y')-y)<.001
    hold('w',f'!window.__app.player.mastClimb&&window.__app.player.deckPos.y>{top-.02}',10000);page.evaluate('window.__app.player.pitch=-.75');page.wait_for_timeout(200);page.screenshot(path=str(OUT/(mid+'_lookout.png')));states.append(snapshot())
    page.keyboard.down('d');page.wait_for_timeout(160);page.keyboard.up('d');page.keyboard.down('a');page.wait_for_timeout(160);page.keyboard.up('a')
    hold('s','!window.__app.player.mastClimb&&window.__app.player.deckPos.y<2.3',10000)
   results['masts']={'lookouts':states,'end':snapshot()}
  run('masts',masts)
  def boarding():
   page.evaluate("async()=>{const a=window.__app,{ladderLocal,BOARDING_LADDERS}=await import('/src/ship/HeritageDeck.js');window.__stormwakeQA.go('boat');if(!a.boatCtl.teleportTo(800,1200,0))throw Error('sea fixture rejected');const l=BOARDING_LADDERS[2],f=ladderLocal(l),p=a.player;p.deckPos.set(f.x,f.y,f.z);p.deckYaw=-Math.PI/2;p.pitch=0;p.deckVel.set(0,0,0);p.deckToWorld()}");page.wait_for_timeout(400)
   page.keyboard.down('s');page.wait_for_function('window.__app.player.boardingClimb?.t>.15');page.keyboard.up('s');t=page.evaluate('window.__app.player.boardingClimb.t');page.wait_for_timeout(500);assert abs(page.evaluate('window.__app.player.boardingClimb.t')-t)<1e-6
   hold('w',"!window.__app.player.boardingClimb&&window.__app.player.mode==='deck'",5000);page.wait_for_timeout(700)
   hold('s',"!window.__app.player.boardingClimb&&window.__app.player.mode==='swim'",7000);page.wait_for_timeout(700)
   hold('w',"!window.__app.player.boardingClimb&&window.__app.player.mode==='deck'",7000);results['boarding']={'paused':t,'end':snapshot()}
  run('boarding',boarding)
  browser.close()
finally:
 server.terminate();server.wait(timeout=15);(OUT/'results.json').write_text(json.dumps({'results':results,'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
assert not errors,errors
assert all(x['pass'] for x in results.values()),[k for k,v in results.items()if not v['pass']]
