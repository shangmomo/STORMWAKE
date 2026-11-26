// STORMWAKE V58: read-only, renderer-independent acceptance gates.
// Treat a logical assertion as a logical assertion; pixel/animation quality
// remains a separate visual review and is never marked green by this file.
export function checkSnapshot(s, {expectPeers = null, expectConnected = false} = {}) {
  const failures = [], warnings = [];
  const fail = (id, message) => failures.push({id, message});
  const warn = (id, message) => warnings.push({id, message});
  if (!s || s.ready !== true) return {failures:[{id:'not_ready',message:'游戏初始化尚未完成'}],warnings};
  const finite3 = p => p && ['x','y','z'].every(k => Number.isFinite(p[k]));
  if (!finite3(s.player?.position)) fail('player_nan','玩家坐标无效');
  if (!finite3(s.ship?.position)) fail('ship_nan','船体坐标无效');
  if (!Number.isFinite(s.world?.hour) || s.world.hour < 0 || s.world.hour >= 24) fail('clock_range','昼夜时钟越界');
  if (!Number.isFinite(s.world?.weatherSeconds)) fail('weather_invalid','天气时间轴无效');
  const a = s.ship?.anchor;
  if (a) {
    if (!Number.isFinite(a.travel) || a.travel < -0.001 || a.travel > 1.001) fail('anchor_range','船锚行程超界');
    if (a.travel > .03 && a.down === false) fail('anchor_state','船锚行程与落锚状态冲突');
    if (!Number.isFinite(a.turns)) fail('windlass_nan','绞盘转角无效');
  }
  if (s.ship?.moored && s.ship?.speed > 2.0) warn('moored_drift','船处于系泊状态但运动速度较高');
  if (expectConnected && !s.multiplayer?.connected) fail('not_connected','联机客户端未完成欢迎握手');
  if (expectPeers !== null && s.multiplayer?.peerCount !== expectPeers) fail('peer_count',`远端玩家数量为 ${s.multiplayer?.peerCount}，期望 ${expectPeers}`);
  if (s.multiplayer?.connected && !Number.isFinite(s.multiplayer?.rttMs ?? 0)) warn('rtt_invalid','网络往返时间无效');
  if (s.player?.mode === 'deck' && ['hold','lowerHold'].includes(s.player?.deckLayer) && s.player?.position.y < s.ship.position.y - 7)
    fail('cabin_fall','角色从船舱坠落至船体下方');
  if (s.ship?.heritage && s.ship?.helmVisible === false) fail('helm_missing','荷兰船的可交互舵轮模型不可见');
  if (s.bosses?.some(b => b.present && !b.visible)) warn('boss_invisible','场景内存在不可见的活体 Boss');
  if ((s.elapsedSeconds||0)>40 && s.bosses?.some(b=>b.present && !b.rigLoaded))
    warn('boss_rig_missing','Boss 3D 动画模型加载超过 40 秒仍未完成');
  if (s.player?.mode === 'deck' && (s.world.hour>=20 || s.world.hour<4) && s.lighting?.active===0)
    warn('unlit_ship','夜间甲板附近没有有效局部光源');
  if (s.water?.waterShaderReady === false) fail('water_renderer_missing','海水着色器未初始化');
  if (s.water?.dryCamera && s.water?.underwaterPost === true) warn('underwater_cabin','船舱相机仍启用了水下后处理');
  return {failures,warnings};
}

export function compareRoomState(a,b,{maxHourDrift=0.08,maxWeatherDrift=2.5}={}) {
  const failures=[];
  if(!a?.multiplayer?.connected || !b?.multiplayer?.connected) failures.push({id:'disconnected',message:'至少一个客户端未连接房间'});
  const h1=a?.world?.hour,h2=b?.world?.hour;
  if(Number.isFinite(h1)&&Number.isFinite(h2)){
    const delta=Math.min(Math.abs(h1-h2),24-Math.abs(h1-h2));
    if(delta>maxHourDrift)failures.push({id:'clock_split',message:`房间时间差 ${delta.toFixed(3)} 小时`});
  } else failures.push({id:'clock_missing',message:'缺少可比较的房间时间'});
  const d=Math.abs((a?.world?.weatherSeconds??NaN)-(b?.world?.weatherSeconds??NaN));
  if(!Number.isFinite(d)||d>maxWeatherDrift)failures.push({id:'weather_split',message:`天气相位差 ${d.toFixed(2)} 秒`});
  return {failures};
}

export function checkScreenshotStats({width=0,height=0,luminanceStd=0,blackRatio=0,whiteRatio=0}={}) {
  const failures=[];
  if(width<640||height<360)failures.push({id:'bad_frame',message:'画面尺寸异常'});
  if(luminanceStd<3)failures.push({id:'solid_frame',message:'画面近乎单色；可能黑屏、白屏或未完成绘制'});
  if(blackRatio>.94)failures.push({id:'black_frame',message:'画面超过 94% 为黑色'});
  if(whiteRatio>.92)failures.push({id:'white_frame',message:'画面超过 92% 近纯白'});
  return {failures};
}
