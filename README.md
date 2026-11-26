# Paseo 的 Antigravity 交互扩展

适配 Paseo 0.17.x 的官方 `antigravity` provider。macOS 已用 Paseo 0.17.3、agy 1.5.9 验证。Paseo 继续管理原有会话、模型和工具权限，扩展通过标准输入输出连接原来的 `agy acp`。

- **问答**。桌面和 Web 客户端在当前会话的回复框里逐题显示选项。选「自定义回答」可以填写文字。「上一题」保留已选答案，「提交回答」一次送回全部选择，「跳过」取消本次提问。原生客户端在对话末尾显示同一张问答卡。
- **公式**。桌面和 Web 客户端在回复中显示行内、块级 LaTeX 及 math 代码块。MathJax 4 随聊天栏宽度给长公式换行。支持美元符号、反斜杠括号及独立的 equation、align 等环境。普通代码块保留原文。
- **交互组件**。在官方 Antigravity 会话里输入 `/generative_ui 做一个可以拖动滑块调整半径的圆，并显示面积`。agy 生成自包含 HTML，桌面和 Web 客户端在回复结束后用独立的沙箱 iframe 展示。脚本可更新组件本身。控件的状态属于当次预览，重新打开会重新初始化。原生 iOS 和 Android 客户端使用 Markdown 回退显示公式和组件源码。

## 公式示例

把下面的内容作为同一条回复渲染时，两个引用都指向编号为 (1) 的公式。下一条回复可以重复使用同一标签。

```tex
前面先引用式 \eqref{energy}。

\begin{equation}
E = mc^2 \label{energy}
\end{equation}

由式 \eqref{energy} 可得结论。
```

## 安装独立插件

在运行 Paseo daemon 的 macOS 或 Linux 主机上准备好 Node.js 和 `agy`，并在 Paseo 设置中启用插件。如果已经克隆本仓库，在仓库根目录执行

```sh
npm ci --legacy-peer-deps --ignore-scripts
paseo plugin install "$PWD"
```

如果使用包含运行依赖的压缩包，可以离线安装到一个长期保留的目录。

```sh
mkdir -p agy-rich-ui
tar -xzf agy-paseo-rich-ui-0.3.0.tgz -C agy-rich-ui --strip-components=1
cd agy-rich-ui
paseo plugin install "$PWD"
```

将 daemon 的 `config.json` 中的 `agents.providers.antigravity.command` 设为下面的数组。用 `command -v node`、`pwd`、`command -v agy` 分别取得本机对应路径。若已自定义启动命令，在原数组前加上 Node 和本插件的 `bridge.mjs` 两项，保留原有参数。已经配置了这两项的主机可以直接复用。

```json
["/path/to/node", "/path/to/agy-paseo/bridge.mjs", "/path/to/agy", "acp", "--disable-telemetry"]
```

运行 `paseo reload --json` 应用启动配置。新会话直接生效；已经打开的会话可以在本轮结束后重新加载。

## 卸载

要还原，恢复原来的 `agents.providers.antigravity.command`。若安装前没有设置该字段，删除该字段即可。运行 `paseo reload --json`，再执行 `paseo plugin remove agy-rich-ui`。插件总开关也用于其他插件，可按需要在设置里管理。

## 实现与验证

适配器在交互会话中声明 ACP 表单能力，将 `elicitation/create` 的选择值送回最初的 JSON-RPC 请求。每张表单使用独立的一次性本地 socket，并校验 Paseo 会话 ID。在历史回放时，失效的表单不会重新向 agy 提交。公式由本地 MathJax 4 排成 SVG。每条回复独立编号，显示公式默认编号，带星号的环境可以省略编号。正文里的前向与后向引用均可点击跳转。交互组件由扩展提供的命令生成，普通 HTML 代码块按代码显示。

从源码开发时运行 `npm ci --legacy-peer-deps --ignore-scripts`、`npm run typecheck` 和 `npm test`。测试覆盖多题、多选、自填、取消、重复提交、会话隔离、公式定界符和组件闭合边界。运行 `npm pack --ignore-scripts` 可重新生成包含运行依赖的独立包。

Google 手册说明了 ACP 表单和官方 Generative UI 的产品范围。[Antigravity ACP](https://antigravity.google/docs/ide/extensions/acp/) · [Generative UI](https://antigravity.google/docs/commands/generative-ui/)
