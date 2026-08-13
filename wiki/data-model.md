# 数据模型

SQLAlchemy 2.0 异步 ORM（`Mapped`/`mapped_column`），三张表。生产 MySQL 8.0（utf8mb4），开发/测试 SQLite。

## 1. users（用户）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | Integer | PK, 自增 | |
| username | String(100) | NOT NULL | |
| email | String(255) | UNIQUE, NOT NULL, index | 登录账号 |
| hashed_password | String(255) | NOT NULL | bcrypt 哈希 |
| ai_invite_verified | Boolean | default False | 是否已验证 AI 邀请码（`AI_INVITE_CODE`） |
| created_at | DateTime(tz) | server_default=now() | |

## 2. jobs（岗位）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | Integer | PK, 自增 | 内部主键 |
| job_id | String(50) | UNIQUE, NOT NULL, index | 源站岗位 ID（与 company 构成去重键） |
| company | String(200) | | 公司 |
| title | String(300) | index | 职位名 |
| recruit_type | String(50) | index | 校招/实习/社招 |
| job_category | String(100) | index | 原始分类（经 normalize 归一到 4 类） |
| job_function | String(100) | | 职能 |
| work_city | String(100) | index | 主城市（原始值，可能含乱码） |
| work_cities | JSON | | 多城市列表 |
| team_intro | Text | | 团队介绍 |
| responsibilities | Text | | 职责（检索用） |
| requirements | Text | | 要求（检索用） |
| bonus_points | Text | | 加分项（检索用） |
| tags | JSON | | 标签 |
| publish_time | DateTime | | 发布时间（可能有 `0000-00-00` 非法值，schema 层清洗） |
| detail_url | String(500) | | 源站链接 |
| fetched_at | DateTime(tz) | | 抓取时间 |
| source_page | String(20) | | 来源站点 |

**注意**：`work_city` 存在编码/别名问题（如"北京市"vs"北京"、海外城市），业务层统一走 `normalize_city_values()` 处理，SQL 层不做城市过滤。

## 3. user_profiles（用户画像）

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | Integer | PK, 自增 | |
| user_id | Integer | FK→users.id, UNIQUE, index | 一用户一画像 |
| profile_json | Text | default `"{}"` | JSON 存储画像 + 对话历史 |
| updated_at | DateTime(tz) | onupdate=now() | |

### profile_json 内部结构
```json
{
  "name": "",
  "education": [{"school": "", "degree": "", "major": "", "graduation": ""}],
  "experiences": [{"type": "internship/project/research/award", "org": "", "role": "", "period": "", "description": ""}],
  "skills": [],
  "target_role": "",
  "target_city": "",
  "recruit_type": "校招/实习/社招",
  "conversation_history": [{"role": "user|assistant", "content": "..."}]  // 最近 20 条
}
```

## 4. 数据导入

- 来源：`data/jobs.jsonl`（7477 行），`JOBS_FILE` 配置
- 时机：应用启动时，仅当 `jobs` 表为空
- 方式：`scripts/import_jobs.py`，幂等批量插入，去重键 `(company, job_id)`
- 相关脚本：`clean_jobs.py` / `clean_jobs_file.py`（清洗，有对应测试）

## 5. 测试约定

- 测试使用内存 SQLite（`conftest.py` 提供 fixture），无需 MySQL
- 覆盖：auth、jobs、ai_match、ai_optimize、clean_jobs、import、models、semantic_vector_service、health、resume 解析
