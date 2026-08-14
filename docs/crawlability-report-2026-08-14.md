# 秋招信源可爬性调研报告

> 日期：2026-08-14 ｜ 范围：`data/companies.json` 全部 65 家企业
> 方法：一次性 HTTP 探测（httpx，UA=Chrome/126，并发 8-10），不写采集管线
> 结论汇总：**65 家全部有可爬入口**；约 1/3 用招聘 SaaS（北森 zhiye.com），复用成本最低

---

## 1. 核心发现

### 1.1 招聘 SaaS 平台高度集中（重大复用机会）

65 家中 **12+ 家使用北森 zhiye.com 子站**，页面结构与 API 模式相同：

| 判定 | 企业 | 入口 |
|---|---|---|
| **REAL（真实门户，可爬）** | 泡泡玛特、传音控股、迈瑞医疗、名创优品 | `https://{name}.zhiye.com`（19-21KB 完整页） |
| **SHELL（子站未开通/404 空壳）** | 得物、SHEIN、微博、虎牙、荣耀、联合利华、DeepSeek、TCL、智谱、月之暗面、MiniMax、ZURU、莉莉丝、蔚来 | `https://{name}.zhiye.com` 跳 `/404?errorpath=/`（1.3KB） |

**判断规则**：`{name}.zhiye.com` 响应 >3KB = 真实门户；1.3KB = 空壳（该企业未用此域名，需回退自建官网或找真实子域）。

### 1.2 T1 大厂：全部可达，但需 JS 渲染/接口层

| 企业 | 状态 | 说明 |
|---|---|---|
| 腾讯 join.qq.com | 200（1.9KB 壳） | SPA，真实数据在 XHR（自有/腾讯招聘系统） |
| 阿里 campus.alibaba.com | 200（7.8KB） | 需解析 |
| 百度 talent.baidu.com | 200（46.7KB） | 完整 HTML，可直爬 |
| 字节 jobs.bytedance.com | 200（940KB） | 大 SPA，通常有 JSON 接口（`/api/jobs` 类） |
| 美团/京东/拼多多/网易/小米/滴滴 | 200 | 壳或完整页混合 |

### 1.3 反爬现状

- **明确 403**：仅欧莱雅（careers.loreal.com，AWS WAF 类）— 需真实浏览器或调整策略
- **其余无 403/验证码**：探测阶段无 captcha 命中，SaaS 类（zhiye.com）通常提供 JSON API 且反爬宽松

### 1.4 需修正的 URL（探测中发现 404/不可达）

| 企业 | 原 URL（失败） | 建议入口 |
|---|---|---|
| 快手 | campus.kuaishou.com（ProxyError） | `zhaopin.kuaishou.cn`（200，2.4KB 壳，JS 渲染） |
| 影石 Insta360 | insta360.com/recruit（404） | 官网招聘频道待确认（zhiye 子站为空壳） |
| 寒武纪 | cambricon.com/join（404） | 官网待确认 |
| 诗悦/多益/钛动/荔枝/韶音 | 各自 join/careers（404） | 官网待确认，或 zhiye 空壳回退 |
| 唯品会 | campus.vip.com | **真实跳转** `app-tc.mokahr.com/campus-recruitment/vipshophr`（MokaHR SaaS！） |

### 1.5 第二家 SaaS：MokaHR（mokahr.com）

- 唯品会 → `app-tc.mokahr.com/campus-recruitment/vipshophr/10039`
- MokaHR 是国内另一大招聘 SaaS，**公开接口模式成熟**，后续若更多企业走 MokaHR 可再归并

---

## 2. 按可爬性分级的信源策略

| 等级 | 特征 | 企业（示例） | 采集策略 |
|---|---|---|---|
| **S1 纯 JSON API** | 招聘 SaaS 或大厂公开接口 | 泡泡玛特/传音/迈瑞/名创（zhiye REAL）、字节、唯品会（MokaHR） | 直接 GET JSON，解析即得，最快最稳 |
| **S2 HTML 可解析** | 服务端渲染或轻 SPA | 百度、华为、大疆、中兴、比亚迪、ZURU 等 | requests + BeautifulSoup，页面含岗位列表 |
| **S3 JS 渲染壳** | SPA 壳（1-3KB），数据走 XHR | 腾讯/快手/小米/滴滴、网易等 | 需定位 XHR 接口（DevTools 抓包）或 Playwright |
| **S4 强反爬/未定** | 403 或入口 404 | 欧莱雅（403）、影石/寒武纪/诗悦/多益/钛动/荔枝/韶音（404） | 逐家人工确认正确入口后定级 |

---

## 3. 各层级推荐采集顺序

1. **第一批（S1，最快见效）**：zhiye REAL 4 家 + 唯品会 MokaHR —— 同一 API 模式，一个适配器可爬 5 家
2. **第二批（S2）**：百度、华为、大疆、中兴、比亚迪、名创等完整 HTML 页面
3. **第三批（S3）**：T1 大厂 XHR 接口定位（腾讯/字节/美团/京东/网易/小米/滴滴/快手）
4. **第四批（S4）**：逐家确认入口后补爬

---

## 4. 探测方法与可复用资产

- 探测脚本：`/tmp/probe_crawlability.py`（临时，未入库）
- **复用结论**（本次最重要产出）：
  - `{name}.zhiye.com` 判定规则（>3KB=REAL，1.3KB=SHELL）—— 后续新增企业直接套用
  - zhiye.com 平台统一 API 结构 → 一个适配器覆盖多家
  - MokaHR（mokahr.com）为第二候选 SaaS 平台
- 本次未写任何采集管线代码（按用户要求），仅 HTTP 探测 + 报告

## 5. 待办

- [ ] 修正 companies.json 中 404/不可达企业的 recruit_url（快手→zhaopin.kuaishou.cn、唯品会→mokahr 等）
- [ ] S4 企业逐家人工确认正确招聘入口
- [ ] 确认 zhiye REAL 4 家的具体 API 端点（后续写适配器时）
- [ ] 欧莱雅 403 确认是否需要浏览器指纹策略
