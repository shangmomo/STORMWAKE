# STORMWAKE · WebGPU 盗贼之海式设计与制作执行手册

> **给执行 AI / 制作人的完整说明书**  
> 工程根目录：`C:\Users\syz\Documents\ChatGPT\3d\Tidewater_V38`  
> 引擎：自研 WebGPU / WGSL（**禁止**迁移 Unity / Unreal）  
> 目标：在 V38 基础上做成《盗贼之海》式 **2–4 人同船协作** 垂直切片（M1），风格化 3A 观感  
> 版权：可参考盗贼之海**手感与结构**，**禁止**使用其任何模型 / 贴图 / 音频 / UI / 商标  
> 配套短版愿景：`docs/STORMWAKE_WebGPU_盗贼之海式重设计方案.md`  
> 本文优先级高于短版；冲突时以本文为准。

---

## A. 执行 AI 必读约束

### A.1 必须遵守

1. 只在 **Tidewater_V38** 内改代码与资源；不要新建 Unity 工程。  
2. **不要重写** `src/engine/**`、`src/ocean/**`（FFT）、`src/sky/**`、`src/post/**` 内核；玩法层扩展为主。  
3. 保持可启动：`python start_v38.py`；有依赖时 `npm run dev` 仍可用。  
4. 每完成一个可测里程碑，补 `test/stormwake-voyage-*.mjs` 或扩展现有 `test/stormwake-v38.mjs`，并跑通相关 node 测试。  
5. 中英 UI 字符串走现有 locale 习惯（参考 `src/course/Localization.js`）。  
6. 第三方资产必须可再分发，写入 `CREDITS.md`；下载失败就如实记录，**禁止虚构已安装**。  
7. 不要声称「已达完美 3A」；验收以本文检查表为准。  
8. 不要破坏 V30+ 潜艇深渊内容的入口，但 **主循环不再引导玩家去潜艇**（可藏在 `?dev=1` 或远期菜单）。

### A.2 明确不要做（M1）

- 完整 live-service、跨服大世界、专用服务器集群  
- 灯塔完整解谜航程、凯洛 Boss 航程化、巨兽全套重做（属 M2/M3）  
- 公网 Relay / TURN（M2）  
- 开放 PvP（M2 黑旗）  
- 为「好看」大规模替换地形/植被系统  
- 把船控改回「一人 WASD 完全掌控帆+舵+炮」而无岗位

### A.3 成功定义（M1 Done）

两人（或一人+AI）能：在海风镇接「金潮藏宝」→ 一人掌舵一人升帆出海 → 到灰苔岛挖宝 → 搬箱上船 → 遭遇或绕开 AI 炮艇 → 回港卖出得潮币。局域网第三人可上船占炮位开火。

---

## B. 产品与玩法设计（完整）

### B.1 一句话

风暴帆港私掠船员接潮汐公会航程，同船操作岗位出航寻宝与交火，再携战利品回海风镇兑现。

### B.2 核心循环

```
整备(修船/补员) → 接航程 → 登船占岗 → 航行
 → 登岛挖掘/搜刮 或 海战
 → 搬运转利品 → 返航风险 → 港口兑现 → 声望/船饰
```

单局目标时长：**20–40 分钟**。

### B.3 公会与内容分层

| 公会 | M1 | M2 | M3 |
|------|----|----|----|
| 金潮商会（寻宝） | 灰苔岛 1 张图 | 第 2 岛、多箱 | 连锁藏宝 |
| 灯塔守望团 | — | 灯塔/镜片航程 | 夜间信号赛 |
| 猎潮会 | AI 炮艇 | 凯洛营地 | 海怪世界事件 |

### B.4 经济

- `tideCoin`（潮币）、`repGoldTide` / `repLighthouse` / `repHunt`（声望）  
- 存档键建议：`stormwake.voyage.v1`（勿覆盖旧钓鱼存档键；可并列读取旧进度）  
- 成长：船饰与航程门槛为主，避免 DPS 数值碾压

### B.5 岗位设计（灵魂系统）

| stationId | 显示名 | 进入条件 | 占用时输入 | 效果 |
|-----------|--------|----------|------------|------|
| `helm` | 舵轮 | 甲板近交互点 | A/D → 舵角 | 改变 `BoatController` 舵输入 |
| `sail_main` | 主帆索 | 甲板 | W/S 或滚轮 → 帆位 0–1 | 主推力来自帆×相对风速 |
| `sail_jib` | 前帆索 | 甲板 | 同上 | 辅助推力/转向微调 |
| `anchor` | 锚绞盘 | 船首 | E 切换 | 抛锚锁水平速；起锚解除 |
| `cannon_port` | 左舷炮 | 炮位 | 鼠标瞄准、LMB 开火、R 装弹 | 生成炮弹 |
| `cannon_starboard` | 右舷炮 | 炮位 | 同上 | 同上 |
| `repair` | 维修桶 | 近木桶 | 按住 LMB 修 | 降 `breach`、升 `integrity` |
| `bucket` | 水桶 | 近水桶 | 持桶到火源 E | 灭火 |
| `carry` | 搬运 | 近宝箱 E | 移速×0.55，不能用炮/修 | 货在「手持」；再 E 放下/交舱 |

规则：

- 同一 `stationId` 同时仅 1 个 actor（玩家或 AI）。  
- 占岗时 **不得** 触发海图/船坞/拍照/拔刀抢键。  
- 离岗：E 或 Esc（Esc 不打开设置若当前在岗位）。  
- 船运动输入 = 岗位汇总；**无人掌舵则保持上一舵角并缓慢回中**；**无人管帆则帆位保持**（不自动最优）。

### B.6 风帆物理（简化可调）

在 `BoatController` 上增加帆力，而不是扔掉浮力积分：

```
windWorld = normalize(windVec)           // 可先用全局风，接 settings
heading = boat forward XZ
appar = wind - boatVel_XZ
drive = sailAmount * max(0, dot(appar, heading)) * sailPower
辅机 thrust_aux = engineThrottle * auxPower   // auxPower 远小于满帆，默认 0.25×旧推力
```

验收：满帆顺风明显快于仅辅机；逆风满帆应慢或需收帆。

### B.7 船体损伤

```
integrity ∈ [0,100]
breach ∈ [0,1]      // 进水
fire ∈ [0,1]
若 breach>0：integrity 持续下降；船质量/吃水表现可简化为加速下沉感
integrity==0：缓沉；货舱物品以漂浮 loot 生成
```

### B.8 航程：金潮 · 灰苔藏宝（M1 唯一主线）

| 字段 | 值 |
|------|-----|
| id | `voyage_gold_moss_01` |
| 接取 | 海风镇告示板或小汐，坐标用港口可行走点（见 §E） |
| 目标岛 | 灰苔岛（新建小岛或主岛远侧高地标记，见 §E） |
| 挖点 | 1 个；持铲/空拳交互读进度 4s |
| 产出 | `treasure_chest_small` ×1（可搬运） |
| 兑现 | 港口金潮收购 `gold_tide_broker` |
| 奖励 | 潮币 120 + `repGoldTide` +1 |
| 威胁 | 返航航道刷 1 艘 AI 炮艇（可被击沉或甩掉） |

### B.9 AI 船员（单人必做）

- 最多 3 名：优先补 `helm`、`sail_main`、`cannon_starboard`。  
- 逻辑：无真人占岗则 AI 占；真人 Interact 同岗时 AI 让出。  
- AI 舵：朝 `voyage` 航点或玩家设置的地图针。  
- AI 帆：根据 `dot(wind, heading)` 调帆位。  
- AI 炮：仅当敌船在舷侧扇区且已装弹。

### B.10 AI 敌船（M1）

- 1 艘炮艇，巡逻灰苔岛回港航线附近。  
- 状态：`patrol` → `engage`（进入 180m）→ `flee`（HP&lt;25%）或 `sink`。  
- 攻击：每 3–5s 舷炮一轮，伤害打在玩家船 `integrity`。  
- 被击沉：掉 0–1 个小箱（可选）。

---

## C. 技术架构

### C.1 新目录（必须创建）

```
src/ship/
  ShipStations.js          # 岗位注册、占领、输入路由
  StationSites.js          # 相对船体的局部锚点与 mesh 提示
  SailWind.js              # 风速与帆力计算
  ShipDamage.js            # integrity/breach/fire
  CrewAI.js                # AI 船员
  EnemyShotgunBoat.js      # AI 炮艇（命名可改但职责不变）
src/voyage/
  VoyageDefs.js            # 航程静态定义
  VoyageDirector.js        # 接取/目标/完成状态机
  DigSite.js               # 挖掘点
  Cargo.js                 # 货舱与世界掉落箱
  Broker.js                # 港口兑现
src/interact/
  InteractionDirector.js   # 全局 E 焦点（可从 land 版提升/复用）
src/net/
  ShipNetBridge.js         # 客户端联机：岗位/船/货协议
server/（扩展）
  coopHub.js               # 增加 ship/voyage 消息处理
test/
  stormwake-voyage-m1.mjs  # M1 逻辑验收
```

### C.2 关键改动的现有文件

| 文件 | 改动要点 |
|------|----------|
| `src/player/BoatController.js` | 增加帆力/辅机比例；接收 `stationInput` 而非直接读全键开船 |
| `src/player/Player.js` | mode 含甲板行走；占岗时移交输入；搬箱移速 |
| `src/core/Input.js` | 配合消费边沿；岗位锁 |
| `src/App.js` | 挂载 VoyageDirector、ShipStations、Cargo、CrewAI、Enemy |
| `src/ui/UI.js` / `AppUI.js` | 航程 HUD、岗位提示、潮币 |
| `src/islandlife/Shipyard.js` | 占岗时禁止打开；换船重置岗位锚点 |
| `src/land/LandControls.js` | 与全局 Interact 统一优先级 |
| `server/coopHub.js` | 见 §D 协议 |
| `src/world/WorldLayout.js` | 增加灰苔岛/告示板/经纪人坐标常量 |

### C.3 建议类接口（实现可微调，语义不可删）

```js
// ShipStations
claim(stationId, actorId) -> boolean
release(stationId, actorId) -> void
update(dt, inputByActor) -> { rudder, sailMain, sailJib, anchorDown, shots[] }
getOccupant(stationId) -> actorId|null

// VoyageDirector
offer(voyageId) / accept() / abandon()
getState() -> { phase, voyageId, objectives[] }
serialize() / deserialize(data)

// Cargo
spawnChest(id, worldPos)
tryPick(actorId) / tryStow(actorId, shipId) / tryDrop(actorId)
listShipHold(shipId) -> items[]

// ShipDamage
applyHit(amount, kind) // 'ball','ram','leak'
repair(dt, rate)
douse(dt)
isSinking() -> boolean
```

---

## D. 联机协议扩展（WebSocket JSON）

现有：`server/coopHub.js`，`MAX_PLAYERS=4`，消息含 `hello/move/chat/fire/boss-*`。  
**保持旧消息可用**；新增如下（Host 权威：房主客户端或 server 模拟船——M1 采用 **server 转发 + 房主客户端权威船状态** 亦可，但须在代码注释写明；推荐逐步把船状态收到 `coopHub`）。

### D.1 客户端 → 服务端

```json
{ "type": "station_claim", "stationId": "helm", "seq": 12 }
{ "type": "station_release", "stationId": "helm", "seq": 13 }
{ "type": "station_input", "stationId": "helm", "seq": 14, "axis": -0.7, "buttons": 0 }
{ "type": "ship_state_host", "seq": 100, "x":0,"y":0,"z":0,"yaw":0,
  "vx":0,"vz":0,"sailMain":0.8,"integrity":100,"breach":0,"fire":0,"anchor":false }
{ "type": "voyage_event", "seq": 20, "verb": "accept"|"dig_progress"|"dig_done"|"sell",
  "voyageId": "voyage_gold_moss_01", "payload": {} }
{ "type": "cargo_event", "seq": 21, "verb": "pick"|"drop"|"stow",
  "itemId": "chest_1", "x":0,"y":0,"z":0 }
```

校验要求（服务端）：

- `stationId` 白名单；一人一岗；重复 claim 拒绝。  
- `station_input` 频率限制（建议 ≥30ms）。  
- `ship_state_host` 仅房主（第一个 joined 或标记 `host=true`）。  
- 伤害/发奖：`sell` 由 server 或房主单点结算并广播，防双端各加一次币。

### D.2 服务端 → 全体

```json
{ "type": "station_update", "stationId": "helm", "actorId": "ab12cd34"|null }
{ "type": "ship_state", "/* 同 host 字段 */" }
{ "type": "voyage_state", "phase": "accepted", "voyageId": "...", "objectives": [] }
{ "type": "cargo_spawn", "itemId": "...", "kind": "treasure_chest_small", "x":0,"y":0,"z":0 }
{ "type": "cargo_despawn", "itemId": "..." }
{ "type": "economy", "id": "ab12cd34", "tideCoin": 120, "repGoldTide": 1 }
{ "type": "enemy_ship", "id": "gunboat_1", "x":0,"z":0,"yaw":0,"hp":100,"state":"engage" }
```

### D.3 单机

无 WebSocket 时，`ShipNetBridge` 走本地 stub：所有 claim/state 立即成功，逻辑与联机共用。

---

## E. 关卡与坐标规范

在 `WorldLayout.js`（或 `src/voyage/VoyageWorld.js`）增加命名常量，**禁止魔法数散落**：

```js
export const STORMWAKE_M1 = {
  noticeBoard: { x: /* 港口可行走 */, z: /* */ },
  broker: { x: /* */, z: /* */ },
  mossIsland: { center: { x, z }, radius: 80 },
  digSite: { x, y, z }, // y 用地形高度运行时采样
  gunboatPatrol: [ { x, z }, { x, z } ],
};
```

选点规则：

1. 告示板 / 经纪人：海风镇已有可走地面，距码头 &lt; 60m。  
2. 灰苔岛：若暂不新建地形 mesh，M1 允许用主岛远侧未密集建筑区域 + 明显路牌/营地道具圈成「灰苔岛登岸点」；文档与 UI 仍称灰苔岛。更优：降低一处离岸沙洲高度做独立小岛（改 `TerrainData` 需谨慎，并加测试）。  
3. 挖点：平坦、坡度 &lt; 20°，周围 3m 无建筑碰撞。

---

## F. UI / UX

### F.1 世界提示

- 可交互物：白色描边或底部 `[E] 掌舵` 风格提示（跟现有 interact 风格一致，避免盗贼之海 UI 复制）。  
- 已占用：`舵轮 · 被凯伊占用`。

### F.2 HUD（低打扰）

- 左上：当前航程名 + 下一目标一句话。  
- 船状态条：完整性 / 进水 / 火（仅受损时显示）。  
- 潮币：港口或 Esc 菜单可见。  
- 岗位时隐藏钓鱼/部分全球快捷提示。

### F.3 新手 90 秒

1. 小汐或告示板强制第一句：「先接航程，再上船找舵轮与帆索。」  
2. 第一次靠近舵轮高亮。  
3. 不强制教学关；可跳过。

---

## G. 美术与音频（M1 范围）

### G.1 视觉

- 继续 URP 等价物：现有 WebGPU PBR / 日照 / 云。  
- 船：现有海盗 fleet 变体可作「潮醒号」；帆位变化至少缩放/旋转帆 mesh。  
- 岗位：简单几何交互体（舵轮盘、索桶、炮管）——可用程序化 Geo，**不必**等外部 Pirate Kit；若下载 Kenney/Quaternius Pirate Kit 成功再替换并记 CREDITS。  
- 宝箱：木箱 + 金属箍程序盒即可。  
- 角色：沿用 V38 海盗 cast；AI 船员用同一批模型不同配色。

### G.2 音频（有则接，无则静音位）

浪（已有）、帆布、木结构吱呀、炮火、锤钉、金币。缺资源用现有 SoundScape 占位事件名，勿假造文件。

---

## H. 分步制作顺序（执行 AI 严格按序）

### Phase 0 — 文档与开关（0.5 日）

1. 保留本手册；在 `README.md` 顶部加 M1 入口说明与 `?voyage=1` 或设置开关。  
2. 增加 `G.voyageM1 = true` 或 URL `?stormwake=1` 启用新循环（默认开）。

### Phase 1 — 交互与岗位（骨架）

1. 实现 `InteractionDirector`（或提升 land 版）：每帧选出最高分交互候选。  
2. `StationSites` 把局部点绑到 `boatCtl.model` 根节点。  
3. `ShipStations.claim/release` + 本地提示。  
4. 占 `helm` 时：仅舵输入进 `BoatController`；取消「E 上船即全身驾驶」。  
5. 占 `sail_main`：改变 `sailAmount`；接入 `SailWind`。  
6. 单机测试：一人无法同时最优操控；需在舵/帆间切换。  
7. 测试：`test/stormwake-voyage-m1.mjs` 先测 claim 互斥与输入路由。

### Phase 2 — 航程与搬箱

1. `VoyageDefs` + `VoyageDirector`。  
2. 告示板 Interact → accept。  
3. `DigSite` 进度条 → spawn chest。  
4. `Cargo` pick/stow/drop；持箱移速惩罚。  
5. `Broker` sell → 潮币。  
6. HUD 目标更新。  
7. 存档 serialize。

### Phase 3 — 损伤、炮、敌船

1. `ShipDamage`；炮击 `applyHit`。  
2. 玩家舷炮岗位（可先复用 hunt 武器轨迹简化为球形弹）。  
3. `repair` / `bucket` 最小闭环。  
4. `EnemyShotgunBoat` 巡逻与交火。  
5. 沉船掉货（最小）。

### Phase 4 — AI 船员

1. `CrewAI` 补空岗。  
2. 单人可完成出航挖宝回港。  
3. 真人抢岗 AI 让位。

### Phase 5 — 联机

1. 扩展 `coopHub` 消息与校验。  
2. `ShipNetBridge`：非房同船看岗位与船状态。  
3. 2 客户端同船：A 舵 B 帆，船真正运动。  
4. 回归旧 `fire`/boss 消息不崩溃（可 skip 玩法）。

### Phase 6 — 打磨与验收

1. 按 §I 检查表逐项勾。  
2. `python start_v38.py` + `node test/stormwake-voyage-m1.mjs`。  
3. 更新 `docs/V39_*.md` 执行记录（诚实写未完成项）。  
4. 版本号：建议标记 **STORMWAKE V39 · Voyage Co-op M1**。

---

## I. M1 验收检查表

### I.1 功能

- [ ] 告示板可接 `voyage_gold_moss_01`  
- [ ] 舵/帆/至少一门炮/修 可占领且互斥  
- [ ] 满帆顺风 &gt; 仅辅机航速  
- [ ] 挖宝产出可搬箱；可进货舱  
- [ ] 经纪人可卖箱得潮币  
- [ ] AI 船员单人可跑通主路径  
- [ ] AI 炮艇会接敌并造成 integrity 下降  
- [ ] 2 人联机：不同岗位同时有效  
- [ ] 占岗时不打开海图/船坞/误攻击  

### I.2 技术

- [ ] 无 WebGPU 内核无故大改  
- [ ] `node --check` 新改 JS 通过  
- [ ] `stormwake-voyage-m1.mjs` 通过  
- [ ] 旧 `test/stormwake-v38.mjs` 无回归（或已更新断言并说明）  
- [ ] CREDITS 已更新（若有新资产）  

### I.3 体验

- [ ] 90 秒内能发现如何让船动  
- [ ] HUD 始终知道下一目标  
- [ ] 破损时修船提示可见  

---

## J. 测试用例规格（供 `stormwake-voyage-m1.mjs`）

纯逻辑、无 GPU：

1. `claim('helm','p1')===true`；`claim('helm','p2')===false`。  
2. `release` 后他人可 claim。  
3. 仅 helm+sail 输入时 `SailWind`+rudder 产生前进分量 &gt; 仅辅机基线。  
4. dig 进度 4s 完成 → cargo 数量 +1。  
5. sell 后 tideCoin 增加且 hold 清空；重复 sell 同一 itemId 无效。  
6. `applyHit(40)` 两次后 integrity 递减；`repair` 回升。  
7. CrewAI：无玩家时占据 helm；玩家 claim helm 后 AI 释放。  
8. 联机 parser：非法 stationId / 过快 input 被拒绝（可单测 hub 方法）。

---

## K. 里程碑时间盒（供排期，可按人力伸缩）

| 阶段 | 内容 | 建议 |
|------|------|------|
| M0 | 本手册 + 开关 | 已完成文档 |
| M1a | 岗位+帆力 | 优先 |
| M1b | 航程+搬箱+兑现 | 优先 |
| M1c | 炮+损伤+敌船 | 优先 |
| M1d | AI 船员 | 优先 |
| M1e | 联机岗位同步 | 优先 |
| M2 | 灯塔、凯洛、声望船饰、黑旗、公网 | 勿在 M1 范围做 |
| M3 | 海怪事件、钓鱼抛光、性能手柄 | 勿在 M1 范围做 |

---

## L. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 船物理与帆力耦合炸调 | 帆力先做水平推力，不动复杂横倾 |
| 联机不同步 | M1 房主权威船状态 10–15Hz 广播 |
| 灰苔岛无独立地形 | 主岛远侧标记区 + UI 文案；记录技术债 |
| 抢键回归 | 所有新系统经 InteractionDirector；加测试 |
| 范围膨胀 | 任何 M2 内容必须新开文档，不得塞进 M1 PR |

---

## M. 交付物清单（执行 AI 最终应交出）

1. 可运行的 V39（或标注版本）代码  
2. `docs/V39_Voyage_Coop_M1_执行与验收.md`（写清通过/未通过）  
3. `test/stormwake-voyage-m1.mjs`  
4. README 启动与双人联机步骤（`python run_coop_windows.py` 或现有 coop 脚本）  
5. 本手册未完成项的诚实列表  

---

## N. 给执行 AI 的开场提示词（可复制）

```
你在 C:\Users\syz\Documents\ChatGPT\3d\Tidewater_V38 工作。
严格按 docs/STORMWAKE_WebGPU_设计与制作执行手册.md 执行 M1。
引擎保持 WebGPU，禁止迁 Unity。
按手册 §H Phase1→5 顺序实现同船岗位、金潮灰苔航程、搬箱兑现、AI船员、AI炮艇、coopHub 协议扩展。
不要做 M2/M3。每阶段补充 test/stormwake-voyage-m1.mjs 并运行测试。
最终写 docs/V39_Voyage_Coop_M1_执行与验收.md。诚实记录未完成项。
```

---

## O. 参考文件速查

| 用途 | 路径 |
|------|------|
| 启动 | `start_v38.py` |
| 船物理 | `src/player/BoatController.js` |
| 船队外观 | `src/world/boat/FleetVariants.js`、`src/islandlife/Shipyard.js` |
| 联机 | `server/coopHub.js`、`server/coopServer.js` |
| 陆地交互 | `src/land/LandInteractionDirector.js`、`LandControls.js` |
| Boss AI 参考 | `src/land/LandCorsairBrain.js` |
| 海战武器参考 | `src/oceanhunt/*` |
| V38 验收 | `docs/V38_单文件成品改造与质量验收.md` |

---

**文档结束。执行时只实现 M1；完成后再开 M2 设计增补页。**
