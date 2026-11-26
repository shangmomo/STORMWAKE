# V79 P0 实施证据与未完成事项

## 源码实施（在用户 V78 解压副本上进行）

| 文件 | 实际改动 | 边界 |
|---|---|---|
| src/core/Input.js | OS 重复按键不能在失焦/菜单后重新激活；编辑框焦点清空；拒绝非有限鼠标和滚轮值 | 未重做全部操作键映射 |
| src/core/ControlPolicy.js | 先检查 Shift 修饰再消费 P，避免照片快捷键被日志路由吞掉 | 保留现有菜单策略 |
| src/interact/InteractionGeometryV79.js、InteractionDirector.js、src/land/LandInteractionDirector.js | 共用有限坐标、范围/高度/优先级校验；稳定 ID 裁决；同帧只派发一次 | 不是所有目标都新增几何遮挡，完整候选注册改造仍待 P1 |
| src/voyage/VoyageM1.js、src/land/LandAdventure.js | 航程抢占 E 前验证候选；未解锁岩心不抢 E；携物/菜单/上下文切换时清除旧陆地候选，再验当前动作权限 | 仍沿用已有跨系统优先级，不是全局统一交互器 |
| src/engine/Engine.js、src/App.js、src/core/FrameTimingV79.js | 防止重复启动帧循环，启动重置时钟，模拟 dt 与实际帧间隔分离；显示真实 fps/均值/p99/最大间隔，记录 p50/p95、长帧和会话最大值 | 没有固定 tick 架构迁移、完整 profiler 或实际 GPU 性能测量；窗口包含可能的前后台间隔 |
| src/game/GameState.js | 非法/负支出拒绝；旧出售、放生、支出、装备升级、加油在存储写入失败时回滚；监听器异常不破坏已经提交的交易 | 新鱼入舱及所有历史存档模块未全部迁移；旧 UI 失败反馈仍需统一 |
| src/land/LandRewardOutboxV79.js、src/land/LandAdventure.js | 远征奖励类型和金额白名单，先记录待发放，再钱包原子结算，失败每2秒重试，重启后读取待发放记录，回执幂等；不再在失败时显示已到账；部分旧存储读取失败安全处理 | 不是全局原子数据库；任务进度、旧标记和钱包仍有分离写入，若恰在两次写入之间崩溃或全部存储均失败，仍有风险；不自动补发升级前历史缺失奖励；不是联机权威奖励 |
| test/stormwake-v67-controls.mjs | 旧碰撞假对象缺 addBox，换用当前真实 Colliders；保留全部原断言和失败日志 | 无放宽断言 |

## 验证

- 新增 8 项 `test/stormwake-v79.mjs`：全部通过（OS 重复、Shift+P、非有限鼠标、双交互器、500ms 真实长帧、交易回滚、回执、奖励重试重载）。`qa/V79-special.log`。
- V78 13 项、V77 6 项、V76 7 项、V75 7 项，最终串行执行日志的这些组均通过；V74–V69 42 项由独立最终执行全部通过（`qa/V79-baseline-regression.log` 和 `qa/V79-regression-core-final.log`）。串行命令因工具执行时限中断，不能称该命令完整结束；独立补跑覆盖其剩余 CPU 组。
- V68 真实四客户端 WebSocket 协议（guest helm、占岗、授权、释放、房主接管）通过，`qa/V79-network.log`。这不是四个浏览器的完整实机通关。
- V67 控制 11 项：初次 10 通过/1 失败，老夹具缺 `addBox`；使用真实 Colliders 后 11/11，通过日志 `qa/V79-controls.log`，原失败 `qa/V79-controls-original-fixture.log`。
- 额外：V33 陆地交互及 M1 20 项逻辑/网络验收通过，V63 交互层与基础 GameState 测试通过。M1 历史测试传入 player 对象而非 position，新交互器兼容该旧输入形态，仍严格检验真实坐标。
- Python HTTP 启动与 App、新增 JS、酒馆 GLB 返回 200。浏览器尝试访问得到 `ERR_BLOCKED_BY_ADMINISTRATOR`，没有进入 DOM 或 WebGPU 游戏场景。见 `qa/V79-browser.log`。没有本轮实机截图、帧率、动画/穿模视觉结论。

## 尚未完成与放行条件

- 地下 A/B/C 层、真实水体、升降机、Lurker、酒馆逐层通行仍未施工完；保留 V78 洞廊，不用低质量替代模型或假传送冒充。
- 真潜艇舱口、分舱损伤及维修、电力、压力、氧气、真实外内壳配准仍未实装。
- 全量三类武器骨骼、海怪动作、帆索连接、船体碰撞、完整生态/资源链、任务图、联机服务权威与断线迁移、无夹具通关仍未完成。
- 资产许可：酒馆、铁匠等旧资产的再分发许可仍需确认；此交付保留用户提供的素材，仅供项目内部验证，不新增第三方模型。
- 不承诺零 bug。该版本是 P0 工程基础修复，不是 P6 发布版。先在可访问的 Chrome/Edge WebGPU 设备按验收矩阵跑实机，再进行任何会改变几何结构的大规模改造。
