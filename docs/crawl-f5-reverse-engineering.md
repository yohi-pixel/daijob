# F5 Playwright 逆向结论（SPA 大厂接口）

> 日期：2026-08-20 ｜ 方法：Playwright 无头浏览器抓 XHR + httpx 重放验证
> 结论：11 家 SPA 中 **9 家可直连 API 采集**（无需真正浏览器渲染），1 家走 SSR 解析，1 家无公开列表

## 1. 飞书 Hire 统一接口（4 家：字节/影石/叠纸/小米）

```
POST {host}/api/v1/search/job/posts?keyword=&limit=10&offset=0&job_category_id_list=&
     tag_id_list=&location_code_list=&subject_id_list=&recruitment_id_list=&
     portal_type={n}&job_function_id_list=&storefront_id_list=&portal_entrance=1
body: {"keyword":"","limit":10,"offset":0,...,"portal_type":n,"portal_entrance":1}
```
- **portal_type**：字节=3，影石=6，叠纸=6，小米=6（飞书 hire 站点编号）
- **limit 上限 10**（>10 返回 405）
- **UA 校验**：必须完整浏览器 UA（简化 UA 返回 405）
- `_signature` 非必需；响应 `data.job_post_list[]`（id/title/description/requirement）
- ⚠️ 无 total 字段，需翻页直到返回空；**字节全站 2000+ 条**，串行请求需后台运行
- 城市：`city_info`（结构不一，取 city_name）

## 2. 美团（zhaopin.meituan.com 社招站）

```
POST https://zhaopin.meituan.com/api/official/job/getJobList
body: {"pageNum":1,"pageSize":20}   # pageSize 单页固定上限 20
响应: {"data":{"list":[{jobUnionId,name,cityList[],jobFamily,desc,...}]}}
```
- **无 total**，返回空即停
- ⚠️ 该站为**社招+海外岗**（jobType=3，科威特/利雅得等），校招入口不同 → 暂不纳入校招库

## 3. 拼多多

```
POST https://careers.pddglobalhr.com/api/careers/api/recruit/position/list
body: {"page":1,"pageSize":50}
响应: {"result":{"list":[{code,name,workLocationName,jobName,jobDuty,releaseTime,...}]}}
```
- 裸请求直连（上轮 40003 是路径错误——正确路径是 /api/careers/api/ 而非 /api/campus/）
- 22 条校招，releaseTime 为毫秒时间戳

## 4. 阿里巴巴

```
GET  https://talent.alibaba.com/         # 先拿 XSRF-TOKEN cookie
POST https://talent.alibaba.com/position/search?_csrf=<token>
body: {"channel":"campus_group_official_site","language":"zh","pageSize":50,"page":1}
响应: {"content":{"datas":[...],"totalCount":N}}
```
- 需 cookie + csrf（同会话即可）；⚠️ 当前非招聘季 totalCount=0（2027 届未开放）

## 5. SHEIN（careers.shein.cn 同域）

```
POST https://careers.shein.cn/api/v1/open/grw/front/jobPage
body: {"current":1,"jobCategoryIds":[],"jobTypeIds":["CAMPUS"],"size":50,...}
响应: {"info":{"total":N,"records":[{jobId,jobTitle,jobCategoryName,releaseDate,...}]}}
```
- 上轮 shein.uunn.cn 502 是错误域名；真实接口同域
- 当前中国站校招 2 条（jobTypeIds=CAMPUS），社招 754 条（source=moka）

## 6. 网易

```
GET https://campus.163.com/api/campuspc/position/getJobList?projectId=103&pageNum=1&pageSize=50
响应: {"data":{"total":N,"list":[{id,positionName,workPlaceName,positionTypeName,...}]}}
```
- 必须 GET（POST 返回 402）；projectId 103=互联网 2027 届

## 7. 虎牙（Moka 平台，走 SSR）

- 岗位页跳转 app.mokahr.com/campus_apply/huya/4112
- jobs 接口 AES 加密；但**页面 init-data 内嵌 SSR 岗位 JSON**（当前 3 条）→ HTML 解析即可

## 8. 欧莱雅（无公开列表，不采集）

- u.hrtps.com 短链 → HRTPS AI 面试系统，22 个请求零岗位数据

## 9. 未适配（本期不做）

- 快手：campus.kuaishou.cn positionBO 参数未破解（需浏览器抓一次确认）
- 多益：xz.duoyi.com 接口已定位但未写适配器
- 网易雷火：projectId=102 复用 NeteaseAdapter（同网易）

## 复用经验

- **UA/Referer/Origin 三件套**是多数大厂接口的最低校验，必须带全
- 飞书 Hire 平台生态（字节/小米/影石/叠纸 + 大量中小企业）≈ 1 个适配器通吃
- 分页无 total 的接口（飞书/美团）用"返回空即停"+ 页数上限
- 大量岗位（字节/美团 2000+）必须后台运行采集
