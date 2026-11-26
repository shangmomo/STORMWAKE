# V4「潮汐港」入口门楼改造交付说明

> 本文件保留上一轮 V4 改造历史。**当前工程已经升级为 V5，请以 `V5_GATEWAY_REDESIGN_zh.md` 为准。** V5 修正了 V4 招牌背面文字、门柱重叠与参考图造型偏差，净宽从本文件记载的 2.94m 调整为 2.86m。

此次直接基于用户上传的 Tidewater V4 项目改动，并非重做游戏或仅提供设计图。

## 新增内容

- 把旧码头的简易方梁和鱼牌改造成海岛风格**双弧形原木门楼**，设有石砌基座、斜撑、金属饰边和铆钉。
- 新增**双面可读的「潮汐港」立体汉字**：沿用已有材质批次，无需在线字体、平面图片字牌或新建文字渲染管线。
- 新增双面椭圆青色木牌、金边和罗盘装饰，并沿用旧版**风吹摆动**机制。
- 在门楼两侧设置渔具浮球、彩色三角旗和花桶；继续沿用原有码头的夜间灯笼。
- 门柱位于木栈桥两侧之外，**门洞净宽 2.94 米**，**牌匾底部距栈桥面 2.22 米**。

## 工程修改位置

| 文件 | 用途 |
|---|---|
| `src/world/HarborGateway.js` | 门楼几何、装饰和碰撞 |
| `src/world/village/HarborLettering.js` | 双面「潮汐港」三维文字 |
| `src/world/Pier.js` | 将门楼接入原始码头、灯笼与摆动系统 |
| `test/harbor-gateway.mjs` | 净空、碰撞和几何数量回归测试 |
| `package.json` | 新增 `npm run test:harbor` 命令 |
| `CREDITS.md` | 汉字字形来源及许可证说明 |

没有修改海水、天空、船只、钓鱼、商店、房屋、昼夜、家园、存档、任务或伙伴「小汐」的已有逻辑，也没有添加新的 npm 运行时依赖。

## Windows 启动与验收

1. 解压完整项目，进入 `tidewater-course` 文件夹。
2. 双击 `START_WINDOWS.cmd`，首次启动需联网安装项目依赖。
3. 使用 Chrome 或 Edge 打开命令窗口给出的本地地址。进入海岛后，走向沙滩与木栈桥交界处观察新门楼。
4. 检查能从门洞中心及左右两侧通过；夜晚灯笼可亮起，有风时吊牌会摇摆。
5. 保持日常使用的浏览器及相同端口，以免误以为存档消失（浏览器按地址及端口隔离存档）。

可在项目目录里运行：

```powershell
npm run test:harbor
npm run test:course
npm run build
```

## 已执行验证

- `npm run test:harbor`：通过；净宽 2.94m、净高 2.22m，九个入门典型行走点均不被静态碰撞阻塞。
- `npm run test:course`：通过，包含家园和伙伴相关检查。
- `node test/game-logic.mjs`：通过，覆盖钓鱼、装备、存档等内容。
- `node test/islandlife-logic.mjs`：通过，覆盖生活、家具、委托与交互规则。
- `npm run build`：通过，生产构建成功。

**验收边界**：当前执行环境没有 Vulkan/WebGPU 图形适配器，无法录制真正的岛屿游戏运行画面或测试真实 FPS；需要在用户的 RTX 4060 Laptop GPU（8 GB）电脑上进行最终视觉与性能验收。本次门楼使用原有材质批次，没有额外独立灯光和新渲染通道。

门楼高度、位置和颜色可在 `src/world/HarborGateway.js` 调整：`beamY`、`poleX`、`palette`。调整后运行 `npm run test:harbor` 检查人物通道。
