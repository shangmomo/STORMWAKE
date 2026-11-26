# V65 验收与已知问题

## 验收范围

- `npm run test:v65` 退出码 0，51 个不同 Node 测试脚本，含 8 项新增专项断言；包括 V64 航行、船舱、移动表面、货物、真实 WebSocket、4 人联机。
- V64 主套件基线退出成功；新增测试、V17 AI、V64 grips 和现有主套件再次全部成功。
- 额外 47 个历史脚本：V64 和 V65 均 26 通过、21 失败，逐脚本退出状态完全一致；未更改历史断言。
- `course-logic`、`course-guide`、`course-homelife` 各自运行成功；原 `npm test` 遇缺失 `webgpu` 依赖停止。
- npm ci --offline 返回 ENOTCACHED，在线 npm ci 也未成功完成。Vite build 未运行。
- Chromium GPU 测试导航被环境策略 ERR_BLOCKED_BY_ADMINISTRATOR 阻止，不能证明新增材质在 GPU 上编译通过。
- Python 原单机启动器 HTTP 资源验证：通过。
- 没有实际桌面游戏实机通关、画面、FPS、显存或长期稳定性证据。

## 本轮缺陷修复

1. 同一 boss 释放重复消息在登记碰撞前去重，防止旧攻击 hits 集合重建。
2. 释放事件携带蓄力时确定的伤害和原点，避免蓄力期间血量/阶段变化导致伤害与技能不匹配。
3. Boss 重生、离线切换、死亡时清理 pending contact、历史接触位置、旧插值目标及演出状态。服务端重生清除旧 attack 记录。
4. 拒绝非法 NaN/无穷/负伤害，AI 拒绝非有限 dt。
5. 服务器快照更新阶段状态；演出预览仅单机，禁用真实接触登记/真实水面冲击。
6. 海龟 heritage 冲撞仅限原 vortex，防止新技能被误判成身体冲撞。
7. 波峰喷沫按释放原点绘制，减少 Boss 移动后特效与判定位置错位。

## 主回归脚本（均通过）

- `test/coop-v13.mjs`
- `test/coop-v14.mjs`
- `test/stormwake-v17.mjs`
- `test/stormwake-v41-ws-cannons.mjs`
- `test/stormwake-v54-systems.mjs`
- `test/stormwake-v55-upgrade.mjs`
- `test/stormwake-v56-systems.mjs`
- `test/stormwake-v57-real-multiplayer.mjs`
- `test/stormwake-v58-autoqa.mjs`
- `test/stormwake-v60-core.mjs`
- `test/stormwake-v60-ws-cargo.mjs`
- `test/stormwake-v61-reliability.mjs`
- `test/stormwake-v62-environment.mjs`
- `test/stormwake-v62-land-stairs.mjs`
- `test/stormwake-v62-stairs.mjs`
- `test/stormwake-v63-actor-pose-ws.mjs`
- `test/stormwake-v63-arsenal.mjs`
- `test/stormwake-v63-beacon.mjs`
- `test/stormwake-v63-cannon-mount.mjs`
- `test/stormwake-v63-cartographer.mjs`
- `test/stormwake-v63-character-forward.mjs`
- `test/stormwake-v63-contacts.mjs`
- `test/stormwake-v63-deck-supplies.mjs`
- `test/stormwake-v63-deep-echo.mjs`
- `test/stormwake-v63-events.mjs`
- `test/stormwake-v63-footprint.mjs`
- `test/stormwake-v63-ghost-geometry.mjs`
- `test/stormwake-v63-ghost-lantern.mjs`
- `test/stormwake-v63-interaction-layers.mjs`
- `test/stormwake-v63-load.mjs`
- `test/stormwake-v63-merchant.mjs`
- `test/stormwake-v63-moving-surfaces.mjs`
- `test/stormwake-v63-repair-materials.mjs`
- `test/stormwake-v63-rig-ik.mjs`
- `test/stormwake-v63-sailor-activity.mjs`
- `test/stormwake-v63-sailor-grips.mjs`
- `test/stormwake-v63-sails.mjs`
- `test/stormwake-v63-shared-supplies.mjs`
- `test/stormwake-v63-skiffs.mjs`
- `test/stormwake-v63-stair-momentum.mjs`
- `test/stormwake-v63-supply-authority.mjs`
- `test/stormwake-v63-supply-ws.mjs`
- `test/stormwake-v63-trade.mjs`
- `test/stormwake-v63-ws.mjs`
- `test/stormwake-v64-grips.mjs`
- `test/stormwake-v64-ladders.mjs`
- `test/stormwake-v64-navigation.mjs`
- `test/stormwake-v64-walking.mjs`
- `test/stormwake-v65-elemental-ecology.mjs`
- `test/stormwake-voyage-m1-ws.mjs`
- `test/stormwake-voyage-m1.mjs`

## 历史额外测试：V64 / V65 对照

| 脚本 | V64 | V65 |
|---|---|---|
| `test/stormwake-stair-route.mjs` | 通过 | 通过 |
| `test/stormwake-v11-fleet.mjs` | 通过 | 通过 |
| `test/stormwake-v11-marine.mjs` | 通过 | 通过 |
| `test/stormwake-v12.mjs` | 失败 | 失败 |
| `test/stormwake-v13.mjs` | 失败 | 失败 |
| `test/stormwake-v14.mjs` | 通过 | 通过 |
| `test/stormwake-v15.mjs` | 失败 | 失败 |
| `test/stormwake-v16.mjs` | 通过 | 通过 |
| `test/stormwake-v18.mjs` | 失败 | 失败 |
| `test/stormwake-v19.mjs` | 失败 | 失败 |
| `test/stormwake-v20.mjs` | 失败 | 失败 |
| `test/stormwake-v21.mjs` | 通过 | 通过 |
| `test/stormwake-v22.mjs` | 通过 | 通过 |
| `test/stormwake-v23.mjs` | 通过 | 通过 |
| `test/stormwake-v24.mjs` | 通过 | 通过 |
| `test/stormwake-v25.mjs` | 通过 | 通过 |
| `test/stormwake-v26.mjs` | 通过 | 通过 |
| `test/stormwake-v27.mjs` | 通过 | 通过 |
| `test/stormwake-v28.mjs` | 通过 | 通过 |
| `test/stormwake-v29.mjs` | 失败 | 失败 |
| `test/stormwake-v30.mjs` | 通过 | 通过 |
| `test/stormwake-v31.mjs` | 通过 | 通过 |
| `test/stormwake-v32.mjs` | 失败 | 失败 |
| `test/stormwake-v33.mjs` | 通过 | 通过 |
| `test/stormwake-v34.mjs` | 通过 | 通过 |
| `test/stormwake-v35.mjs` | 通过 | 通过 |
| `test/stormwake-v36.mjs` | 通过 | 通过 |
| `test/stormwake-v37.mjs` | 通过 | 通过 |
| `test/stormwake-v38.mjs` | 通过 | 通过 |
| `test/stormwake-v40-playflow.mjs` | 失败 | 失败 |
| `test/stormwake-v41-ship-reliability.mjs` | 失败 | 失败 |
| `test/stormwake-v42-systems.mjs` | 失败 | 失败 |
| `test/stormwake-v43-assets.mjs` | 通过 | 通过 |
| `test/stormwake-v43-core.mjs` | 失败 | 失败 |
| `test/stormwake-v44-heritage-sea.mjs` | 通过 | 通过 |
| `test/stormwake-v44-phase1.mjs` | 失败 | 失败 |
| `test/stormwake-v44-phase2.mjs` | 通过 | 通过 |
| `test/stormwake-v45-hull-weather-input.mjs` | 失败 | 失败 |
| `test/stormwake-v47-cc0-assets.mjs` | 通过 | 通过 |
| `test/stormwake-v48-playable-ship.mjs` | 失败 | 失败 |
| `test/stormwake-v49-original-hull.mjs` | 失败 | 失败 |
| `test/stormwake-v50-quarters-rig-water.mjs` | 失败 | 失败 |
| `test/stormwake-v51-original-ship.mjs` | 失败 | 失败 |
| `test/stormwake-v52-rebuilt-cabin.mjs` | 失败 | 失败 |
| `test/stormwake-v53-lower-hold-usable-weapons.mjs` | 失败 | 失败 |
| `test/stormwake-v9.mjs` | 通过 | 通过 |
| `test/stormwake-voyage-m1-integrated.mjs` | 失败 | 失败 |

## 仍失败的历史测试

这些失败在未修改的 V64 中也复现；部分是旧资产/旧功能断言，部分是真正未定位的遗留缺陷。不能仅凭失败退出码相同判定实际问题全部解决。详见 `qa/v65/legacy-comparison.json`。

## 后续验收优先级

1. Chrome/Edge 真实 GPU 编译、首帧、海底视觉与四只巨兽完整战斗；运行 v65-gpu.html。
2. 单机/双人/四人实机下技能距离、掉线重连、重生、躲避和伤害一致性。
3. 120 秒压力测试，记录 GPU/CPU 帧时间和资源占用；适当增加海洋生物 LOD。
4. 对 21 个遗留失败逐项区分旧规格与真实功能缺陷；不要直接放宽断言。
