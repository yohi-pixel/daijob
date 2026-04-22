import math
import re
from collections import Counter
from typing import Iterable, Optional


CITY_ALIAS_MAP = {
    "北京市": "北京",
    "上海市": "上海",
    "广州市": "广州",
    "深圳市": "深圳",
    "杭州市": "杭州",
    "重庆市": "重庆",
    "天津市": "天津",
}

OVERSEAS_KEYWORDS = {
    "海外", "境外", "全球", "international", "overseas",
    "tokyo", "singapore", "london", "new york", "paris", "berlin", "sydney",
    "东京", "新加坡", "伦敦", "纽约", "巴黎", "柏林", "悉尼", "大阪", "洛杉矶", "旧金山", "多伦多", "温哥华",
    "美国", "日本", "欧洲", "英国", "德国", "法国", "澳洲", "加拿大", "东南亚",
}

CATEGORY_KEYWORDS = {
    "技术类": ["技术", "研发", "开发", "工程", "后端", "前端", "算法", "ai", "数据"],
    "产品运营类": ["产品", "运营", "增长", "市场", "内容"],
    "设计类": ["设计", "ui", "ux", "视觉", "交互"],
    "职能类": ["人力", "财务", "法务", "行政", "采购", "支持", "综合职能"],
}

SEPARATORS_RE = re.compile(r"[\\/|,，、;；]+")
EN_TOKEN_RE = re.compile(r"[a-z0-9_+#.-]+")
ZH_CHUNK_RE = re.compile(r"[\u4e00-\u9fff]+")


def split_raw_values(value: Optional[str]) -> list[str]:
    if value is None:
        return []
    text = str(value).strip()
    if not text:
        return []
    chunks = SEPARATORS_RE.split(text)
    return [c.strip() for c in chunks if c and c.strip()]


def _looks_overseas(token: str) -> bool:
    t = token.strip().lower()
    if not t:
        return False
    if t in OVERSEAS_KEYWORDS:
        return True
    if any(k in t for k in OVERSEAS_KEYWORDS):
        return True
    # Heuristic: ASCII city names are treated as overseas.
    if re.search(r"[a-z]", t):
        return True
    return False


def normalize_city_token(token: str) -> Optional[str]:
    t = token.strip()
    if not t:
        return None
    t = CITY_ALIAS_MAP.get(t, t)
    if t.endswith("市") and len(t) <= 4:
        t = t[:-1]
    if _looks_overseas(t):
        return "海外"
    return t


def normalize_city_values(primary: Optional[str], cities: Optional[Iterable]) -> list[str]:
    raw: list[str] = []
    if cities:
        if isinstance(cities, str):
            raw.extend(split_raw_values(cities))
        else:
            for c in cities:
                if c is None:
                    continue
                raw.extend(split_raw_values(str(c)))
    raw.extend(split_raw_values(primary))

    normalized: list[str] = []
    seen = set()
    for token in raw:
        city = normalize_city_token(token)
        if not city:
            continue
        if city in seen:
            continue
        seen.add(city)
        normalized.append(city)
    return normalized


def normalize_job_category(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    lowered = text.lower().replace(" ", "")
    for standard, keywords in CATEGORY_KEYWORDS.items():
        if any(k in lowered for k in keywords):
            return standard
    if text.endswith("类"):
        return text
    return text


def parse_signed_filter(raw: Optional[str]) -> tuple[str, Optional[str]]:
    """Return (mode, value): mode in {'include', 'exclude', 'ignore'}.

    Examples:
    - '+北京' -> ('include', '北京')
    - '-北京' -> ('exclude', '北京')
    - '北京' -> ('include', '北京')
    - ''/None -> ('ignore', None)
    """
    if raw is None:
        return "ignore", None
    text = str(raw).strip()
    if not text:
        return "ignore", None
    if text[0] == "+":
        value = text[1:].strip()
        return ("include", value) if value else ("ignore", None)
    if text[0] == "-":
        value = text[1:].strip()
        return ("exclude", value) if value else ("ignore", None)
    return "include", text


def tokenize_text(text: Optional[str]) -> list[str]:
    if not text:
        return []
    source = str(text).lower()
    tokens: list[str] = []

    tokens.extend(EN_TOKEN_RE.findall(source))

    for chunk in ZH_CHUNK_RE.findall(source):
        if len(chunk) >= 2:
            tokens.append(chunk)
            tokens.extend(chunk[i:i + 2] for i in range(len(chunk) - 1))
        tokens.extend(list(chunk))

    return [t for t in tokens if t]


def bm25_scores(query_tokens: list[str], doc_tokens_list: list[list[str]], k1: float = 1.5, b: float = 0.75) -> list[float]:
    if not query_tokens or not doc_tokens_list:
        return [0.0] * len(doc_tokens_list)

    n_docs = len(doc_tokens_list)
    doc_lengths = [len(tokens) for tokens in doc_tokens_list]
    avgdl = sum(doc_lengths) / n_docs if n_docs else 0.0

    df = Counter()
    for tokens in doc_tokens_list:
        for term in set(tokens):
            df[term] += 1

    idf = {}
    for term in set(query_tokens):
        term_df = df.get(term, 0)
        idf[term] = math.log(1 + (n_docs - term_df + 0.5) / (term_df + 0.5)) if term_df >= 0 else 0.0

    q_freq = Counter(query_tokens)
    scores: list[float] = []
    for i, tokens in enumerate(doc_tokens_list):
        tf = Counter(tokens)
        dl = doc_lengths[i]
        score = 0.0
        for term, qf in q_freq.items():
            if term not in tf:
                continue
            denom = tf[term] + k1 * (1 - b + b * (dl / avgdl if avgdl else 0))
            score += idf.get(term, 0.0) * (tf[term] * (k1 + 1) / denom) * qf
        scores.append(score)
    return scores


def cosine_tfidf_scores(query_tokens: list[str], doc_tokens_list: list[list[str]]) -> list[float]:
    if not query_tokens or not doc_tokens_list:
        return [0.0] * len(doc_tokens_list)

    n_docs = len(doc_tokens_list)
    df = Counter()
    for tokens in doc_tokens_list:
        for term in set(tokens):
            df[term] += 1

    def term_idf(term: str) -> float:
        term_df = df.get(term, 0)
        return math.log((1 + n_docs) / (1 + term_df)) + 1.0

    q_tf = Counter(query_tokens)
    q_vec = {t: q_tf[t] * term_idf(t) for t in q_tf}
    q_norm = math.sqrt(sum(v * v for v in q_vec.values())) or 1.0

    scores: list[float] = []
    for tokens in doc_tokens_list:
        d_tf = Counter(tokens)
        d_vec = {t: d_tf[t] * term_idf(t) for t in d_tf}
        d_norm = math.sqrt(sum(v * v for v in d_vec.values())) or 1.0
        dot = sum(q_vec.get(t, 0.0) * d_vec.get(t, 0.0) for t in q_vec)
        scores.append(dot / (q_norm * d_norm))

    return scores


def rrf_merge(scores_a: list[float], scores_b: list[float], k: int = 60) -> list[float]:
    def rank_from_scores(scores: list[float]) -> list[int]:
        pairs = sorted(enumerate(scores), key=lambda x: x[1], reverse=True)
        ranks = [0] * len(scores)
        rank = 1
        for idx, score in pairs:
            if score <= 0:
                ranks[idx] = 0
                continue
            ranks[idx] = rank
            rank += 1
        return ranks

    ranks_a = rank_from_scores(scores_a)
    ranks_b = rank_from_scores(scores_b)

    merged = []
    for ra, rb in zip(ranks_a, ranks_b):
        sa = 1.0 / (k + ra) if ra > 0 else 0.0
        sb = 1.0 / (k + rb) if rb > 0 else 0.0
        merged.append(sa + sb)
    return merged
