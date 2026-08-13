# 前端（React 版）

> 2026-08-13 起，前端已从 Vanilla JS 现代化重写为 React。新代码位于 `frontend/` 独立目录，旧 `pages/` + `js/` 保留用于回退。

## 1. 技术栈

- **构建**：Vite 5 + TypeScript 5
- **UI**：React 18 + Tailwind CSS 3（M3 色板，45 个 color token 从旧页面内联 config 迁入）
- **路由**：React Router 6（createBrowserRouter）
- **状态**：zustand 4（auth/savedJobs/resume/resumeSnapshots）
- **服务端数据**：TanStack Query 5
- **测试**：Vitest + jsdom + Testing Library（7 文件 43 用例）

## 2. 路由与页面

| 路由 | 页面 | 来源 |
|---|---|---|
| `/` | 重定向 → /jobs | |
| `/jobs` | JobsPage | home.html Tab1 discover |
| `/jobs/:id` | JobDetailPage | job-detail.html |
| `/saved` | SavedPage | home.html Tab3 saved |
| `/map` | MapPage | home.html Tab2 map |
| `/resume` | ResumePage | home.html Tab4 resume |
| `*` | NotFoundPage | |

## 3. 目录结构

```
frontend/src/
├── types/       # job/auth/resume/ai/api TS 类型（统一简历 schema）
├── lib/         # apiClient/storage/sse/resumeCompat/resumeQuota/resumeText/resumeExport/formFields
├── services/    # authApi/jobsApi/aiApi（HTTP 层）
├── hooks/       # useSSE/useSavedJobs/useDebounce/useInvite/useToast
├── stores/      # zustand：auth/savedJobs/resume/resumeSnapshots
├── components/  # layout/common/jobs/map/saved/resume/pixel
└── pages/       # 6 个页面组件
```

## 4. 关键实现

### 4.1 简历 schema 统一（最高风险点，已解决）
旧代码三套命名漂移（store 用 `module_type`，pixel-assistant 读 `type`，resume.js 死代码）。
- `lib/resumeCompat.ts`：`normalizeResumeModule` 兼容两种命名，`OLD_TYPE_MAP` 映射 project→experience
- `parseResumeModulesLS` 统一读入口：parse + normalize + 过滤 is_deleted
- **修复存量 bug**：旧 `buildResumeContext` 读 `m.type` 而存储为 `module_type`，导致对话上下文注入为空

### 4.2 配额（以代码为准）
`basic_info:1 / experience+education+award 合计 10 / summary:5 / skill:1 / snapshots:2`
- 纯函数 `lib/resumeQuota.ts`（checkQuota/getQuotaStatus），可单测

### 4.3 SSE（自研 useSSE）
后端 3 个 SSE 端点（chat/optimize-module/analyze-job-fit）为 POST + text/event-stream，**EventSource 不适用**。
- `hooks/useSSE.ts`：fetch + ReadableStream + TextDecoder 逐行 buffer 解析
- `lib/sse.ts`：`parseSSELine` 纯函数（content/profile_ready/[DONE]）
- 403 → 邀请码失效；abort 幂等；卸载自动 abort

### 4.4 像素精灵
`components/pixel/`：Canvas 逐像素动画（spriteFrames 纯数据）+ SSE 对话 + 邀请码门禁（useInvite）+ 画像推荐 + 简历提取（ExtractModal）。

## 5. 开发

```bash
cd frontend
npm install
npm run dev        # :5173，/api 代理 → localhost:8000
npm run test       # Vitest 43 用例
npm run build      # 产物 frontend/dist/
```

后端照旧：`cd backend && uvicorn main:app --reload --port 8000`

## 6. 部署

- `Dockerfile.nginx` 已改为**多阶段构建**：`node:20-alpine` 编译前端 → `nginx:alpine` 托管
- React 构建产物直接替换 `/usr/share/nginx/html/` 根目录，SPA fallback（`try_files ... /index.html`）与 `/api` SSE 反代已就绪，**nginx.conf 无需改动**
- 旧页面保留在 `/pages/` 与 `index.legacy.html`，可灰度回退
- `deploy.sh`/`update.sh` 走 `docker-compose build` 自动触发前端构建，无需改动

## 7. localStorage 兼容

保留旧 key（`yesjob_token` / `yesjob_user` / `yesjob_saved_jobs` / `yesjob_resume_modules` / `yesjob_resume_snapshots` / `yesjob_resume_text` / `yesjob_ai_invite_verified`），启动时经 resumeCompat 兼容清洗，旧数据无损迁移。
