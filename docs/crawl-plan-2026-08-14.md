# 逮JOB 秋招采集方案（信源调研汇总）

> 日期：2026-08-14 ｜ 数据源：`data/companies.json`（65 家）
> 本文件为采集管线设计依据，不含采集实现代码。字段定义见文末"输出字段映射"。

---

## 1. 采集策略总览（按数据来源分组）

| 数据来源 | 数量 | 采集方式 | 优先度 |
|---|---|---|---|
| **api**（JSON API 直连） | 15 | 直接 POST/GET + 解析 JSON（其中 6 家 MokaHR 需 AES 解密） | **P0 先做** |
| **html**（SSR 可解析） | 2+ | requests + BeautifulSoup 解析 HTML | P1 |
| **browser**（SPA 需渲染） | 11 | Playwright 无头浏览器抓 XHR | P2 |
| **unknown**（待确认） | 4+ | 人工确认入口后归入上面三类 | 待定 |
| 未标记（官网可访问但未深探） | 33 | 逐家补探后归类 | 滚动 |

---

## 2. 平台适配器设计（核心复用点）

### 2.1 北森 zhiye.com 适配器（4 家直连 + 1 家 HTML）

```python
# 统一接口（无需鉴权）
POST https://{site}.zhiye.com/api/Jobad/GetJobAdPageList
body: {"pageIndex": 1, "pageSize": 50, "categoryId": 2}   # categoryId 可不传=全部
resp: {"Code":200, "Count":346, "Data":[{Id,JobAdId,JobAdName,OrgId,CategoryId,
       LocNames[],Salary,Duty,Require,Degree,YearsOfWorking,Welfare,Status,...}]}
```
- 企业/站点/tenantId：popmart(111276) / transsion(107447) / mindray(106239) / miniso(109979)
- 辅助端点：`GetJobAdSearchConditions`（筛选）、`SearchJobClassConditions`（分类树）、`SearchAreasTreeConditions`（地区树）
- 同平台 HTML 解析：smic（smics.zhiye.com/campus，SSR 岗位名直接嵌入）
- ⚠️ 注意：当前 Count 为全量（含社招），秋招过滤需用 CategoryId/关键词

### 2.2 MokaHR 适配器（7 家：唯品会/诗悦/微博/韶音/钛动/完美/滴滴）

```python
POST https://app.mokahr.com/api/outer/ats-apply/website/jobs/v2
body: {"orgId":"<org>","siteId":"<site>","limit":50,"offset":0,"isCampusJob":true,"locale":"zh-CN"}
resp: {"data":"<AES密文>","necromancer":"<key>"}   # 需要解密
```
- **AES-128-CBC/Pkcs7 解密**（已用 pycryptodome 实测通过）：
  - key = 响应字段 `necromancer`（16 字符 hex，如 "b2153ae6d030481d"）
  - iv = 页面 HTML `<input id="init-data">` 中的 `aesIv`
  - 明文：`{code:0, data:{jobStats:{total:N}, jobs:[{id,title,status,orgId,deptId,hireMode,createdAt,openedAt,publishedAt,showIsCampus,campusSites,category2Id}]}}`
- 各企业 org/site：
  | 企业 | orgId | siteId | 备注 |
  |---|---|---|---|
  | 唯品会 | vipshophr | 10039 | 当前 0 条（秋招未发布）；8015 实习门户 3 条 |
  | 诗悦 | shiyuehr | 72055 | 入口 campus.shiyue.com |
  | 微博(新浪) | sina | 43536 | 入口 career.sina.com.cn |
  | 韶音 | aftershokzhr | 40779 | 入口 hr.shokz.com.cn |
  | 钛动 | tec-do | 41717 | 入口 app.mokahr.com |
  | 完美世界 | pwrd | 144582 | 入口 app.mokahr.com |
  | 滴滴 | didiglobal | 96064 | host=campus.didiglobal.com |
- 先 GET 页面拿 cookie（csrfCk/connect.sid/moka-apply）+ Referer/Origin，再 POST
- 其他端点：`/group-by-job`（城市分组）、`/jobs/v2/filterFieldsAggregations`（筛选聚合，明文）

### 2.3 大厂自有 API（直连 4 家：腾讯/京东/多益 + 快手半可用）

| 企业 | 接口 | 要点 |
|---|---|---|
| 腾讯 | `POST join.qq.com/api/v1/position/searchPosition` | 需 Referer；`recruitType:1` 筛应届；`{status:0,data:{positionList:[...]}}` |
| 京东 | `POST campus.jd.com/api/wx/position/page?type=present` | 需 X-Requested-With；`{success:true,body:{totalNumber,items}}`；先 GET getProjectList |
| 多益 | `POST xz.duoyi.com/v40/api/index/positions/jds/page` | 另有 filters 端点 |
| 快手 | `POST campus.kuaishou.cn/recruit/campus/e/api/v1/open/positions/simple` | positionBO 字段待浏览器抓包确认 |

### 2.4 SPA 需浏览器（11 家，P2）

- 字节（飞书 Hire）、网易（微前端）、小米（强反爬验证页）、阿里（baxia WAF）、美团（登录）、拼多多（签名 40003）、SHEIN（网关）、虎牙（需 zhinengId）、影石（飞书）、叠纸（飞书）、欧莱雅（HRTPS）
- 统一方案：Playwright → 监听 XHR → 复用上面 API 模式（飞书 Hire / 自研网关）→ 落库

---

## 3. 输出字段映射（JSONL 落 `data/jobs.jsonl`）

| 采集字段 | 来源 | 说明 |
|---|---|---|
| job_id | 各源 Id/JobAdId/publishId | 源站唯一 ID，与 company 构成去重键 |
| company | 适配器配置 | 企业名 |
| title | JobAdName/title/positionName | 职位名 |
| recruit_type | 配置或字段 | 校招/实习/社招 |
| job_category | CategoryId/类别映射 | 归一化 4 类（技术/产品运营/设计/职能） |
| job_function | 字段 | 职能 |
| work_city / work_cities | LocNames/workCities | 需经 normalize_city_values 归一 |
| responsibilities/requirements/bonus_points | Duty/Require/Welfare | 职责/要求/福利 |
| tags | 平台标签 | |
| publish_time | openedAt/publishedAt | |
| detail_url | 源站详情 | 从源站拼 |
| fetched_at | 采集时间 | |

> 消费端：`backend/scripts/import_jobs.py`（幂等，`INSERT OR IGNORE`）——采集产出 JSONL 后重启后端即导入。

---

## 4. 分阶段实施计划

| 阶段 | 内容 | 验证 |
|---|---|---|
| **F1** zhiye 适配器 | 4 家直连 + 字段映射 | 拉取 Count 与库中条数一致 |
| **F2** MokaHR 适配器 | 7 家 + AES 解密 | 解密后 total 与页面一致；pycryptodome 已验证 |
| **F3** 大厂直连 | 腾讯/京东/多益 | 分页拉全量 |
| **F4** HTML 解析 | 中芯/荔枝/百度首页 | 解析结果抽查 |
| **F5** Playwright | 11 家 SPA | 抓 XHR → 统一落库 |
| **F6** 待确认 | 寒武纪/三七/联合利华/快手参数 + 33 家未深探 | 逐家确认后并入 |

---

## 5. 关键注意事项

1. **合规**：所有源仅采集公开招聘页面数据；控制请求频率（每家 ≥1s 间隔）；遵守 robots 与源站条款
2. **反爬**：所有接口带完整 UA + Referer/Origin；MokaHR 先取 cookie；遇到 403/验证码降级为 Playwright
3. **秋招时效**：当前各源 Count 为全量（含社招），**F1-F3 落地后需按季筛选**——用 publishedAt/openedAt 过滤 2026-09 之后岗位，或按项目名（如"2027届"/"秋招"）关键词
4. **去重**：job_id + company 联合唯一（import_jobs.py 已实现幂等）
5. **增量**：建议每日增量采集（新增/更新 openedAt > 上次 fetched_at），全量每周一次

## 6. 待办清单

- [ ] 快手 positionBO 字段抓包确认
- [ ] 确认 33 家未深探企业入口（尤其 T1 补全：美团/拼多多/字节/网易/小米已探，华为/OPPO/vivo/大疆等待深探）
- [ ] 寒武纪/三七互娱/联合利华正确入口人工确认
- [ ] 欧莱雅 HRTPS 是否纳入（无公开岗位列表，建议标记"不采集"）
