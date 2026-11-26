# STORMWAKE V64 AutoQA 实机检测报告

环境：Windows-10-10.0.26200-SP0

浏览器运行验证：True；游戏初始化验证：True

| 项目 | 状态 | 结论 |
|---|---|---|
| server | pass | 本地 HTTP http://127.0.0.1:5193 |
| room_server | pass | 真实 WebSocket 房间服务器已启动 |
| browser_launch | pass | Chromium 配置 {'channel': 'msedge'} |
| game_initialization | pass | 游戏引擎初始化并已安装开发诊断接口 |
| start_overlay_dismissed | pass | 截图开始前确认开场遮罩已退出 |
| logic_startup | pass | [] |
| visual_captain_spawn | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_spawn | pass | [] |
| visual_captain_dock | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_dock | pass | [] |
| visual_captain_anchor | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_anchor | pass | [] |
| visual_captain_helm | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_helm | pass | [] |
| visual_captain_cabin | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_cabin | pass | [] |
| visual_captain_lower_hold | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_lower_hold | pass | [] |
| visual_captain_beach | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_beach | pass | [] |
| visual_captain_boss | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_boss | pass | [] |
| visual_captain_open_sea | captured | 画面已获取，仍需视觉审阅；不能仅凭像素统计判断精美或无穿模 |
| logic_captain_open_sea | pass | [] |
| offshore_wildlife | pass | 远海生物激活=True；可见数量=16 |
| route_cargo_repeated | pass | 5 held W/S round trips; no E or position resets |
| route_cabin_repeated | pass | 5 complete cabin-to-desk-to-deck keyboard trips; E only opens door |
| interact_anchor | pass | 真实按键 E 取得岗位='anchor' |
| anchor_winding | pass | 真实按键 W 绞盘行程：1.000 -> 0.615 |
| interact_helm | pass | 真实按键 E 取得岗位='helm' |
| logic_captain_connected | pass | [] |
| logic_crew_connected | pass | [] |
| two_clients | pass | 两个真正的 WebGPU 游戏上下文都已接入同一房间 |
| keyboard_movement | pass | 真实键盘移动距离 2.60 米 |
| remote_avatar | pass | 双方玩家都有真实可见的远端角色对象（需视频检查动作质量） |
| remote_live_motion | pass | 远端目标更新位移 2.60m；与真实玩家位置误差 0.00m |
| shared_world_time_weather | pass | 房间昼夜偏差 0.0004 小时；天气时轴偏差 0.023 秒 |
| night_captain | captured | 双机夜景截图已采样 |
| night_crew | captured | 双机夜景截图已采样 |
| real_4_clients | pass | 4 个独立 WebGPU 页面同房间，各有 3 名远端角色 |
| capstan_distinct_seats | pass | ['anchor', 'anchor_2', 'anchor_3', 'anchor_4'] |
| cooperative_capstan | pass | 实按 W：hands=4，行程 0.615 -> 0.387 |
| capstan_release_stops | pass | 松键后 hands=0，绞盘转角变化 0.0000 |
| physical_anchor_all_clients | pass | 全部实际 WebGPU 页面已装载实体锚和锚链 |
| spectral_hp_replication | pass | [63, 63, 63, 63] |
| host_handoff | pass | 剩余客户端房主数 1；船位变化 0.042m |
| spectral_handoff | pass | 迁移后幽灵舰 HP=63 |

## 不能自动证明的内容
- 截图异常检测只筛选可疑画面，不代表达到商业 3A 美术品质
- 动态 WebGPU 画面及船体隔水需要在真实 GPU 驱动上执行
