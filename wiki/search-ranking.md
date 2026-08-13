# 搜索与排序（混合检索）

核心文件：`backend/services/search_utils.py`（算法）+ `backend/services/job_service.py`（编排）+ `backend/services/semantic_vector_service.py`（向量）。

## 1. 检索流程（`_rank_jobs_by_hybrid`）

```
查询 q
 ├─ tokenize_text(q)          # 分词（中文字符 + 双字 n-gram + 英文 token）
 ├─ BM25(q, 职位标题)          # 标题精排
 ├─ 向量相似度(q, 职责+要求+加分项)  # BGE-small-zh-v1.5
 │    └─ 不可用 → TF-IDF 余弦降级
 ├─ RRF 融合 (k=60)           # Reciprocal Rank Fusion
 ├─ title boost               # 标题精确命中 +0.08，token 重叠 +0.06·重叠率
 └─ score>0 保留，按 score 降序
```

## 2. 分词策略（`tokenize_text`）

- 英文/数字 token：`[a-z0-9_+#.-]+`
- 中文：整块 ≥2 字加入 + 所有相邻双字 n-gram + 单字
- 全部 lowercase

## 3. BM25（`bm25_scores`）

- 参数：k1=1.5, b=0.75
- 文档频率按 `set(tokens)` 去重统计
- IDF：`log(1 + (N - df + 0.5) / (df + 0.5))`

## 4. 向量检索（`semantic_vector_service`）

- 模型：`BAAI/bge-small-zh-v1.5`（sentence-transformers），`EMBEDDING_MODEL` 可配
- 实现：FAISS `IndexFlatIP`（内积，embedding 已归一化）；无 FAISS 时 numpy matmul 降级
- 缓存：LRU 式（20000 条上限，超限淘汰最早插入），SHA1 作 key
- 单例 + 线程锁，`available()` 检测 sentence-transformers 是否安装
- 任一环节异常 → 返回 None，调用方降级（保证搜索不挂）

## 5. RRF 融合（`rrf_merge`）

- `score = Σ 1/(k + rank)`，k=60
- score≤0 的项 rank 视为 0（不参与融合）
- 融合后加标题 boost，>0 才进入结果集

## 6. 筛选规范化（search_utils）

### 城市（`normalize_city_values` / `normalize_city_token`）
- 别名映射：北京市→北京、上海市→上海 等 7 组
- 去"市"字（≤4 字）
- 海外关键词（30+ 个中英文词）→ 统一归为"海外"
- 分隔符拆分：`\ / | , ， 、 ; ；`
- 去重保序

### 职位类别（`normalize_job_category`）
关键词归一到 4 大类：
| 标准类 | 关键词 |
|---|---|
| 技术类 | 技术/研发/开发/工程/后端/前端/算法/ai/数据 |
| 产品运营类 | 产品/运营/增长/市场/内容 |
| 设计类 | 设计/ui/ux/视觉/交互 |
| 职能类 | 人力/财务/法务/行政/采购/支持/综合职能 |

### 排除筛选（`parse_signed_filter`）
- `+北京` / `北京` → include
- `-北京` → exclude（前端用 +/- 表达排除逻辑）

## 7. 列表页排序

| sort 值 | 逻辑 |
|---|---|
| `latest`（默认） | publish_time 降序（null 排最后） |
| `relevance` | 上述混合检索 |
| 其他 | 按 id 升序 |

## 8. 动态筛选（`/api/jobs/meta/dynamic-filters`）

对每个筛选维度：在"排除该维度"的条件下，查询其余维度过滤后的剩余可选值——即当前筛选态下各下拉框的可选项，避免出现空组合。

## 9. 已知工程细节

- 城市过滤**必须在 Python 层**做：DB 中 `work_city` 有编码乱码，SQL `WHERE` 无法可靠匹配；实现为"SQL 只过滤其余三字段，城市在内存过滤"
- `get_filters` 全量扫描 jobs 构建筛选项（数据量 7k+ 级可接受）
- 城市优先级排序：广州 > 北京 > 上海 > 深圳 > 杭州，其余字母序
