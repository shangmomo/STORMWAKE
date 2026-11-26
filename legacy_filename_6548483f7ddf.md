# Stormwake V15：远洋巨兽与开发者船队

## 本版本已修改

1. 巨兽不再扎堆港口。四种首领拥有相隔 1.5 km 以上的独立巡游领地，距离港口约 1.6–4.3 km，巡游半径 56–92 m。
2. 航海图扩展至约 4.4 × 5.3 km，岛屿原有地形纹理正确缩放至海图的近岸部分；远洋显示等深线、分区名称、1 km 比例尺，目标距离超过 1000 m 时以 km 显示。
3. 海面 CDLOD 随相机移动且不限制在岛屿 2 km 地形纹理内；原引擎的 CPU/GPU 地形查询在纹理范围外返回 -90 m 深海底，无需扩充昂贵的 2048² 纹理。
4. 联机玩家坐标与弹丸原点校验上限从 ±1020 m 提升至 ±6000 m，伤害校验允许实体在自己的巡游半径内运动。
5. 巨兽不再套用船只配件材质；新增分别用于鲨鱼、乌贼、龟甲、利维坦的生物表面着色，采用非金属、较高粗糙度、噪声微纹理，降低塑料/金属反光。
6. 开发者打开 J 船坞后六种船型均可选择，包括铁鲸号；不再要求先锻造。仍要求登船或在港口船坞，并在航速低于 1.8 m/s 时切换，以保护物理状态。

## 3D 外部模型资源状态（重要）

**目前代码仍在显示原有程序化巨兽几何。** 本版本只改善了材质和远洋逻辑；外部高质量模型不包含在压缩包中。Sketchfab 下载需账号认证，未获得原始文件前不能声称已经替换为新模型。

| 生物 | 作者 | 3D 模型页面 | 许可 |
|---|---|---|---|
| 大白鲨 | CanYuTsai | https://sketchfab.com/3d-models/great-white-shark-carcharodon-carcharias-6a08bdc55884492ca66cfa9f589ff82f | CC BY |
| 巨海龟 | Ignas | https://sketchfab.com/3d-models/sea-turtle-ddb6789834f0412090863e8fd3c0c4db | CC BY |
| 大王乌贼 | Bluh | https://sketchfab.com/3d-models/giant-squid-4823127eab7c4d8a81a9f72a96fd89db | CC BY |
| 利维坦（动画优先） | oliverwstevens | https://sketchfab.com/3d-models/leviathan-normal-material-531f6c585b194f9bb32f70cf23c8477b | CC BY |
| 利维坦（细节优先） | Lebin Benny | https://sketchfab.com/3d-models/leviathan-monster-57285685b5f746c7abab880f2498da37 | CC BY |
| 利维坦（轻量备用） | OfficialBadRabbit | https://sketchfab.com/3d-models/leviathan-sea-monster-creature-model-3b7de5c0c4c747b686bf7527ea99e741 | CC BY |

注意：Sketchfab CC BY 模型使用后需在游戏 credits / 关于界面和发行材料中保留作者、资源链接与许可说明。不要使用《深海迷航》 Reaper / Ghost Leviathan 或《最终幻想》的游戏角色提取模型，仅凭第三方发布的 CC 声明无法覆盖原作版权。

## 测试

```bash
npm run build
npm run test:v15
npm run test:course
npm run test:pirate
```

`test:v15` 包含旧版 V11–V14 全部回归测试，另测试远洋距离、巨兽彼此间距、远洋水深、海图投影、材质非金属、全部船型不加锁。生产构建与 Node 测试通过；没有完成浏览器 WebGPU 画面实际验收，需要在支持 WebGPU 的电脑上运行、实际驾船至四个海域检查水面连续性与着色效果。
