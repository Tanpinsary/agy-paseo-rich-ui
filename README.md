# Antigravity Rich UI for Paseo

为 Paseo 的官方 Antigravity 会话添加问答卡、LaTeX 公式和交互组件。插件用 Node.js 连接 `agy acp`，用 TypeScript 和 React 构建界面，用 MathJax 4 排版公式。

## 适用范围

插件安装在运行 Paseo daemon 的 macOS 或 Linux 主机上，需要 Node.js、agy 和 Paseo 0.17.x（至少 0.17.3）。

桌面版和 Web 版支持全部功能。原生 iOS 和 Android 客户端在对话中显示问答卡，公式和组件按普通 Markdown 显示。

## 安装

在 Paseo 设置中启用插件。在 daemon 主机上克隆本仓库，保留仓库目录，并在仓库根目录运行

```sh
npm ci --omit=dev --legacy-peer-deps --ignore-scripts
paseo plugin install "$PWD"
```

编辑 daemon 的配置文件（默认为 `~/.paseo/config.json`），将 `agents.providers.antigravity.command` 设为下面的数组，把三个路径换成本机的绝对路径。如果已有自定义启动命令，在原数组前加上 Node 和 `bridge.mjs` 两项即可。

```json
["/path/to/node", "/path/to/agy-paseo-rich-ui/bridge.mjs", "/path/to/agy", "acp", "--disable-telemetry"]
```

运行 `paseo daemon reload`，然后新建或重新加载一个 Antigravity 会话。

## 使用

- agy **提问**时，在回复框选择选项或填写自定义答案，再点「提交回答」。
- 回复里的 **LaTeX 公式**（`$…$` 或 `$$…$$`）会自动排版，长公式随聊天栏宽度换行。块级公式在每条回复内独立编号。用 `\label{energy}` 标记公式后，正文中的 `\eqref{energy}` 会显示为可点击的编号。
- 要生成**交互组件**，输入 `/generative_ui 做一个可以用滑块调整半径的圆`，回复完成后即可拖动滑块。
