# Rule-based resume parser — no LLM dependency
import io
import re
from typing import Any

from fastapi import HTTPException

from schemas.resume_parse import ExperienceModule, ParsedResume

# ── Section header patterns ───────────────────────────────────────────────────
SECTION_PATTERNS = {
    'education': re.compile(r'^教育背景|^教育经历|^学历'),
    'experience': re.compile(r'^实习.*经历|^工作.*经历|^项目.*经历|^实习及项目|^经历'),
    'award': re.compile(r'^奖项|^荣誉|^获奖|^竞赛|^比赛'),
    'skill': re.compile(r'^技能|^专业技能|^技术栈|^掌握'),
    'summary': re.compile(r'^自我描述|^个人简介|^自我评价|^关于我'),
}

# ── Entry header: "名称|职位  时间" or "名称|职位\t时间" ─────────────────────
# Matches: 钛动科技|广告优化实习生 2026.1-2026.4
ENTRY_RE = re.compile(
    r'^(.+?)[|｜/／](.+?)[\s\t]+([\d]{4}[\.\-/年]\d{1,2}.*?)(?:\s+.*)?$'
)
# Matches entry without pipe: "项目名 时间 备注"
ENTRY_NO_PIPE_RE = re.compile(
    r'^(.+?)[\s\t]+([\d]{4}[\.\-/年]\d{1,2}[^\s]*(?:[-至~到]\S+)?)\s*(.*)?$'
)
# Education line: "2023.9 至今 GPA:... 学校/专业"
EDU_RE = re.compile(
    r'^([\d]{4}[\.\-/年]\d{0,2})\s*[-至~到\s]+\s*(\S+)\s+'
    r'(?:GPA[：:]\s*([\d\.]+/[\d\.]+)[（(][^)）]*[)）]\s*)?'
    r'(.+?)[/／](.+)$'
)
# Basic info patterns
PHONE_RE = re.compile(r'(?:手机|电话|Tel)[：:]\s*([\d\-\s]{7,})')
EMAIL_RE = re.compile(r'(?:邮箱|Email|mail)[：:]\s*(\S+@\S+)')
AGE_RE = re.compile(r'年龄[：:]\s*(\d+)')
LOCATION_RE = re.compile(r'(?:地址|城市|所在地)[：:]\s*(\S+)')
TARGET_RE = re.compile(r'求职意向[：:]\s*(.+)')
SKILL_SPLIT_RE = re.compile(r'[、，,；;/／\s]+')


def extract_text(file_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith('.pdf'):
        try:
            import pdfplumber
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                pages = [p.extract_text() or '' for p in pdf.pages]
            return '\n'.join(pages).strip()
        except ImportError:
            raise HTTPException(status_code=500, detail='pdfplumber not installed')
    elif lower.endswith('.docx'):
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            return '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
        except ImportError:
            raise HTTPException(status_code=500, detail='python-docx not installed')
    else:
        raise HTTPException(status_code=400, detail='Unsupported file type. Use PDF or DOCX.')


def _clean(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def _parse_basic_info(lines: list[str]) -> dict[str, Any]:
    info: dict[str, Any] = {}
    full = ' '.join(lines[:6])

    # Name: first non-empty line that's short and has no colon
    for line in lines[:3]:
        line = line.strip()
        if line and len(line) <= 10 and '：' not in line and ':' not in line:
            info['name'] = line
            break

    m = TARGET_RE.search(full)
    if m:
        info['target_role'] = _clean(m.group(1))

    m = PHONE_RE.search(full)
    if m:
        info['phone'] = _clean(m.group(1))

    m = EMAIL_RE.search(full)
    if m:
        info['email'] = _clean(m.group(1))

    m = AGE_RE.search(full)
    if m:
        info['age'] = m.group(1)

    m = LOCATION_RE.search(full)
    if m:
        info['location'] = _clean(m.group(1))

    return info


def _parse_education_line(line: str) -> dict[str, Any] | None:
    m = EDU_RE.match(line.strip())
    if not m:
        return None
    return {
        'start_date': m.group(1),
        'end_date': m.group(2),
        'gpa': m.group(3) or '',
        'school': _clean(m.group(4)),
        'major': _clean(m.group(5)),
    }


def _collect_bullets(lines: list[str], start: int) -> tuple[str, int]:
    """Collect bullet/continuation lines after an entry header."""
    desc_parts = []
    i = start
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        # Stop if new section header or new entry header
        if any(p.match(line) for p in SECTION_PATTERNS.values()):
            break
        if ENTRY_RE.match(line):
            break
        # Stop if looks like a new entry (short line with | and date)
        if '|' in line or '｜' in line:
            break
        desc_parts.append(re.sub(r'^[•·\-\*\uff65\u2022]\s*', '', line))
        i += 1
    return '\n'.join(desc_parts), i


def _parse_entry(line: str) -> dict[str, Any] | None:
    """Parse an experience entry header line."""
    line = line.strip()
    m = ENTRY_RE.match(line)
    if m:
        org = _clean(m.group(1))
        role = _clean(m.group(2))
        date_str = _clean(m.group(3))
        # Split date range
        date_parts = re.split(r'[-至~到]', date_str, maxsplit=1)
        start = date_parts[0].strip() if date_parts else ''
        end = date_parts[1].strip() if len(date_parts) > 1 else ''
        return {'org': org, 'role': role, 'start_date': start, 'end_date': end}
    return None


def _detect_section(line: str) -> str | None:
    stripped = line.strip()
    for sec, pat in SECTION_PATTERNS.items():
        if pat.match(stripped):
            return sec
    return None


def parse_text(text: str) -> ParsedResume:
    lines = [l for l in text.splitlines()]
    non_empty = [l for l in lines if l.strip()]

    if not non_empty:
        return ParsedResume()

    basic_info = _parse_basic_info(non_empty)
    experiences: list[ExperienceModule] = []
    skill: dict[str, Any] | None = None
    summary: dict[str, Any] | None = None

    current_section: str | None = None
    i = 0

    # Skip header lines (name, target, basic info) — first ~3 lines
    header_end = 0
    for idx, line in enumerate(non_empty[:6]):
        stripped = line.strip()
        if any(p.match(stripped) for p in SECTION_PATTERNS.values()):
            header_end = idx
            break
        # Education line without section header (docx style)
        if EDU_RE.match(stripped):
            header_end = idx
            break
    else:
        header_end = min(3, len(non_empty))

    i = header_end

    while i < len(non_empty):
        line = non_empty[i]
        stripped = line.strip()

        # Section header detection
        sec = _detect_section(stripped)
        if sec:
            current_section = sec
            i += 1
            continue

        # Education line (with or without section header)
        if current_section == 'education' or (current_section is None and EDU_RE.match(stripped)):
            edu = _parse_education_line(stripped)
            if edu:
                # Collect course info from next line
                desc_parts = []
                j = i + 1
                while j < len(non_empty):
                    nxt = non_empty[j].strip()
                    if not nxt:
                        j += 1
                        continue
                    if _detect_section(nxt) or ENTRY_RE.match(nxt) or EDU_RE.match(nxt):
                        break
                    desc_parts.append(nxt)
                    j += 1
                edu['description'] = '\n'.join(desc_parts)
                experiences.append(ExperienceModule(module_type='education', data=edu))
                i = j
                continue

        # Skill section
        if current_section == 'skill':
            items = [s for s in SKILL_SPLIT_RE.split(stripped) if s.strip()]
            if items:
                if skill is None:
                    skill = {'items': []}
                skill['items'].extend(items)
            i += 1
            continue

        # Summary section
        if current_section == 'summary':
            parts = []
            while i < len(non_empty):
                nxt = non_empty[i].strip()
                if _detect_section(nxt):
                    break
                parts.append(nxt)
                i += 1
            summary = {'content': '\n'.join(parts)}
            continue

        # Award section
        if current_section == 'award':
            entry = _parse_entry(stripped)
            if entry:
                desc, i = _collect_bullets(non_empty, i + 1)
                experiences.append(ExperienceModule(
                    module_type='award',
                    data={'name': f"{entry['org']}|{entry['role']}", 'date': entry['start_date'], 'description': desc}
                ))
            else:
                # Plain award line
                experiences.append(ExperienceModule(
                    module_type='award',
                    data={'name': stripped, 'date': '', 'description': ''}
                ))
                i += 1
            continue

        # Experience section (or docx without section headers)
        if current_section in ('experience', None):
            entry = _parse_entry(stripped)
            if entry:
                desc, i = _collect_bullets(non_empty, i + 1)
                experiences.append(ExperienceModule(
                    module_type='experience',
                    data={
                        'org': entry['org'],
                        'role': entry['role'],
                        'start_date': entry['start_date'],
                        'end_date': entry['end_date'],
                        'description': desc,
                    }
                ))
                continue

        i += 1

    return ParsedResume(
        basic_info=basic_info if basic_info else None,
        experiences=experiences,
        skill=skill,
        summary=summary,
    )


async def parse_resume(file_bytes: bytes, filename: str, has_basic_info: bool = False) -> ParsedResume:
    text = extract_text(file_bytes, filename)
    if not text.strip():
        return ParsedResume()
    result = parse_text(text)
    if has_basic_info:
        result.basic_info = None
    return result
