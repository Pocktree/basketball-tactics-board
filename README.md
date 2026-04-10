# 🏀 Basketball Tactics Board

一个基于 Web 的篮球战术板应用，支持在浏览器中实时绘制、编辑和演示篮球战术。

![Next.js](https://img.shields.io/badge/Next.js-16.2-black)
![React](https://img.shields.io/badge/React-19.2-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ 功能特性

### 战术绘制
- 🏀 **球员控制** - 拖拽球员到任意位置，支持 10 名球员（5主队 + 5客队）
- ✏️ **路径绘制** - 点击球员绘制移动路径，支持传球路线
- 🔄 **动画演示** - 自动播放战术跑位动画
- ⏱️ **时间控制** - 动画播放速度可调

### 战术板
- 📐 **半边球场** - 标准 NBA 半边球场视图
- 🎨 **主题切换** - 支持自定义球场颜色
- 📱 **响应式布局** - 适配桌面和移动设备

### 数据管理
- 💾 **本地存储** - 战术自动保存到浏览器本地
- 📤 **导出功能** - 战术数据可导出/导入

### 战术演示
- 🏆 **计分板覆盖层** - 内置比赛计分板组件
- ⏯️ **播放控制** - 播放/暂停/重置动画

## 🛠️ 技术栈

| 技术 | 用途 |
|------|------|
| **Next.js** | React 框架 |
| **React Konva** | Canvas 渲染引擎 |
| **GSAP** | 高性能动画 |
| **Zustand** | 状态管理 |
| **Tailwind CSS** | 样式框架 |
| **TypeScript** | 类型安全 |

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:3000 启动。

### 构建生产版本

```bash
npm run build
npm run start
```

## 📁 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── globals.css        # 全局样式
│   └── page.tsx           # 首页
├── components/            # React 组件
│   ├── TacticsBoard.tsx   # 战术板核心组件
│   └── ScoreboardOverlay.tsx  # 计分板组件
├── lib/                    # 工具函数
│   └── tacticsStorage.ts  # 本地存储管理
└── store/                 # Zustand 状态管理
    └── tacticsBoardStore.ts
```

## 🎮 使用说明

1. **添加球员** - 点击空位添加球员
2. **移动球员** - 拖拽球员到目标位置
3. **绘制路径** - 选中球员后点击画布绘制路径
4. **播放动画** - 点击播放按钮预览战术

## 📄 开源协议

本项目基于 MIT 协议开源。

---

Made with ❤️ for basketball coaches and enthusiasts 🏀
