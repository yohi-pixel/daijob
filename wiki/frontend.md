# 前端

纯 Vanilla JS + Tailwind CSS（无框架、无构建步骤，除 CSS 编译外）。开发时由 `serve.py` 静态托管并反代 `/api/*`。

## 1. 页面（pages/）

| 页面 | 功能 |
|---|---|
| home.html | 岗位搜索 + 列表 + 筛选（110KB，最大页面，含像素精灵助手集成） |
| job-detail.html | 岗位详情 + AI 匹配 |
| resume-editor-kinetic.html | 动效简历编辑器 |
| resume-editor-precision.html | 结构化简历编辑器 |

## 2. JS 模块（js/）

| 模块 | 职责 |
|---|---|
| api.js | API 客户端：token 管理（localStorage `yesjob_token`）、统一 fetch 封装 |
| pixel-assistant.js | Canvas 像素精灵浮窗 + 多轮对话 UI（SSE 消费） |
| resume-store.js | 简历数据管理（localStorage CRUD） |
| resume-ai.js | 简历 AI 优化交互 |
| resume-pdf.js | 简历快照导出 PDF/Word |
| resume.js | 简历编辑逻辑 |

## 3. 关键机制

- **鉴权**：`api.js` 从 localStorage 读 token，注入 `Authorization: Bearer`；401 清 token
- **SSE 消费**：前端用 EventSource/fetch-stream 读取 `data: {...}` 增量渲染（像素精灵对话、模块优化）
- **简历存储**：`resume-store.js` localStorage CRUD（无后端存储，纯本地）
- **筛选交互**：`home.html` 使用 `/api/jobs/meta/dynamic-filters` 动态刷新下拉选项，支持 `+/-` 排除筛选
- **路径约定**：`/` → `pages/home.html`（serve.py 内映射）

## 4. 开发

```bash
python serve.py 3000          # 前端 + /api 代理
npm run build:css             # 编译 Tailwind（tailwind.config.js）
```

## 5. 已知要点

- 前后端通过 `/api` 同源路径通信（代理或 Nginx 反代），无跨域问题
- 首页体积大（110KB HTML + 内联），性能优化空间：拆组件/懒加载
- AI 对话、简历优化均依赖 SSE，Nginx 层已配 `X-Accel-Buffering: no`
