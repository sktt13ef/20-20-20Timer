# 20-20-20 护眼计时器

一个 Windows 桌面护眼计时器，用来践行 20-20-20 准则：每 20 分钟专注后，提醒用户远眺休息 20 秒。

## 功能

- 20-20-20 自动计时
- 小窗模式
- 窗口置顶
- 提示音和系统通知
- CSV 导入导出计时状态、规则、提醒偏好和记录
- Windows 解压即用打包

## 开发

```bash
npm install
npm run dev
```

## 检查和构建

```bash
npm run lint
npm test
npm run build
```

## 生成 Windows 解压版

```bash
npm run package:win
```

生成的 zip 位于 `release/` 目录。解压后运行 `护眼计时器.exe`。
