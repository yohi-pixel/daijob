/**
 * pixel-assistant.js
 * Canvas pixel sprite floating assistant with multi-turn chat, RAG job recommendation.
 */

const SPRITE_SCALE = 3;
const PX = SPRITE_SCALE;

// Pixel art sprite frames (8x16 grid, each cell = 1px before scale)
// Colors: skin=#f5c5a3, hair=#3d2b1f, shirt=#9d3d00, pants=#2d2f2e, eye=#2d2f2e
const COLORS = {
  S: '#f5c5a3', // skin
  H: '#3d2b1f', // hair
  T: '#9d3d00', // shirt (primary brand color)
  P: '#2d2f2e', // pants
  E: '#1a1a1a', // eye
  W: '#ffffff', // white
  _: null,      // transparent
};

// 16x24 sprite pixel map (row by row)
const SPRITE_IDLE = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,H,H,H,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,E,S,E,S,H,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,S,H,_,_,_,_,_,_,_',
  '_,_,_,H,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,_,T,T,T,T,T,_,_,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
];

// Talking frame: mouth open
const SPRITE_TALK = [
  '_,_,_,H,H,H,H,_,_,_,_,_,_,_,_,_',
  '_,_,H,H,H,H,H,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,H,S,E,S,E,S,H,_,_,_,_,_,_,_',
  '_,_,H,S,S,W,S,S,H,_,_,_,_,_,_,_',
  '_,_,_,H,S,S,S,H,_,_,_,_,_,_,_,_',
  '_,_,_,T,T,T,T,T,_,_,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,S,T,T,T,T,T,T,T,S,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,T,T,T,T,T,T,T,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,P,P,_,_,P,P,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
  '_,_,S,S,_,_,S,S,_,_,_,_,_,_,_,_',
];

function drawSprite(ctx, frame, offsetY = 0) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  frame.forEach((row, y) => {
    row.split(',').forEach((cell, x) => {
      const color = COLORS[cell.trim()];
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(x * PX, (y + offsetY) * PX, PX, PX);
    });
  });
}

function createAssistantDOM() {
  const el = document.createElement('div');
  el.id = 'pixelAssistant';
  el.innerHTML = `
<style>
#pixelAssistant {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9000;
  user-select: none;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
}
#paSprite {
  cursor: pointer;
  display: block;
  image-rendering: pixelated;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.25));
  transition: transform 0.1s;
}
#paSprite:hover { transform: scale(1.05); }
#paBubble {
  position: absolute;
  bottom: calc(100% + 8px);
  right: 0;
  background: white;
  border: 2px solid #9d3d00;
  border-radius: 16px 16px 4px 16px;
  padding: 8px 12px;
  font-size: 12px;
  color: #2d2f2e;
  max-width: 200px;
  white-space: pre-wrap;
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  pointer-events: none;
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s, transform 0.2s;
}
#paBubble.visible { opacity: 1; transform: translateY(0); }
#paWindow {
  position: fixed;
  bottom: 100px;
  right: 24px;
  width: 340px;
  max-height: 520px;
  background: white;
  border-radius: 20px;
  box-shadow: 0 16px 48px rgba(45,47,46,0.18);
  border: 1px solid rgba(172,173,172,0.2);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 8999;
}
#paWindow.hidden { display: none; }
#paWindow.fullscreen {
  bottom: 0; right: 0; left: 0; top: 0;
  width: 100%; max-height: 100%;
  border-radius: 0;
  display: grid;
  grid-template-columns: 60% 40%;
  grid-template-rows: auto 1fr auto;
}
#paWindow.fullscreen #paHeader { grid-column: 1 / -1; }
#paWindow.fullscreen #paMessages { grid-column: 1; grid-row: 2; }
#paWindow.fullscreen #paRecommendSection {
  grid-column: 2; grid-row: 2;
  border-top: none; border-left: 1px solid #f0f1ef; max-height: none;
}
#paWindow.fullscreen #paInputArea { grid-column: 1 / -1; grid-row: 3; }
#paHeader {
  background: linear-gradient(135deg, #9d3d00, #ff7a34);
  color: white;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  flex-shrink: 0;
}
#paHeader .pa-title { font-size: 14px; font-weight: 700; }
#paHeader .pa-subtitle { font-size: 11px; opacity: 0.8; margin-top: 1px; }
#paCloseBtn { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; font-size: 18px; line-height: 1; padding: 0; }
#paCloseBtn:hover { opacity: 1; }
#paExpandBtn { background: none; border: none; color: white; cursor: pointer; opacity: 0.8; font-size: 16px; line-height: 1; padding: 0; }
#paExpandBtn:hover { opacity: 1; }
#paMessages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}
.pa-msg { display: flex; gap: 8px; align-items: flex-start; }
.pa-msg.user { flex-direction: row-reverse; }
.pa-msg-bubble {
  max-width: 75%;
  padding: 8px 12px;
  border-radius: 16px;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.pa-msg.bot .pa-msg-bubble { background: #f0f1ef; color: #2d2f2e; border-radius: 4px 16px 16px 16px; }
.pa-msg.user .pa-msg-bubble { background: #9d3d00; color: white; border-radius: 16px 4px 16px 16px; }
.pa-msg-avatar { width: 28px; height: 28px; border-radius: 50%; background: #ff7a34; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
.pa-typing { display: flex; gap: 4px; padding: 8px 12px; }
.pa-typing span { width: 6px; height: 6px; background: #acadac; border-radius: 50%; animation: paTyping 1.2s infinite; }
.pa-typing span:nth-child(2) { animation-delay: 0.2s; }
.pa-typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes paTyping { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-6px)} }
#paRecommendSection {
  padding: 8px 12px;
  border-top: 1px solid #f0f1ef;
  flex-shrink: 0;
  max-height: 280px;
  overflow-y: auto;
}
#paRecommendSection.hidden { display: none; }
.pa-job-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid rgba(172,173,172,0.3);
  border-radius: 10px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}
.pa-job-card:hover {
  background: #f0f1ef;
  border-color: #9d3d00;
  transform: translateX(2px);
}
.pa-job-card-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ff7a34;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}
.pa-job-card-body {
  flex: 1;
  min-width: 0;
}
.pa-job-title {
  font-size: 13px;
  font-weight: 600;
  color: #2d2f2e;
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-job-company {
  font-size: 11px;
  color: #5a5c5b;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pa-job-meta {
  font-size: 10px;
  color: #767776;
  display: flex;
  gap: 8px;
}
.pa-job-meta span:not(:last-child)::after {
  content: '·';
  margin-left: 8px;
  color: #acadac;
}
.pa-job-arrow {
  font-size: 20px;
  color: #9d3d00;
  flex-shrink: 0;
  transition: transform 0.2s;
}
.pa-job-card:hover .pa-job-arrow {
  transform: translateX(3px);
}
.pa-job-optimize-btn {
  padding: 4px 10px;
  background: transparent;
  color: #9d3d00;
  border: 1px solid #9d3d00;
  border-radius: 12px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.pa-job-optimize-btn:hover {
  background: #9d3d00;
  color: white;
}
#paInputArea {
  padding: 10px 12px;
  border-top: 1px solid #f0f1ef;
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
#paInput {
  flex: 1;
  border: 1px solid rgba(172,173,172,0.4);
  border-radius: 20px;
  padding: 8px 14px;
  font-size: 13px;
  outline: none;
  font-family: inherit;
  resize: none;
  max-height: 80px;
  overflow-y: auto;
}
#paInput:focus { border-color: #9d3d00; }
#paSendBtn {
  width: 36px;
  height: 36px;
  background: #9d3d00;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background 0.15s;
}
#paSendBtn:hover { background: #8a3500; }
#paSendBtn:disabled { background: #acadac; cursor: not-allowed; }
#paSaveResumeBtn {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  color: #9d3d00;
  border: 1px solid #9d3d00;
  border-radius: 20px;
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  transition: all 0.15s;
}
#paSaveResumeBtn:hover { background: #9d3d00; color: white; }
#paExtractOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
#paExtractOverlay.hidden { display: none; }
#paExtractModal {
  background: white;
  border-radius: 16px;
  padding: 20px;
  max-width: 480px;
  width: 90%;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 16px 48px rgba(0,0,0,0.2);
}
.pa-extract-module { border: 1px solid #e0e1df; border-radius: 10px; padding: 12px; margin-bottom: 10px; }
.pa-extract-module label { display: flex; align-items: flex-start; gap: 8px; cursor: pointer; }
.pa-extract-module-title { font-size: 12px; font-weight: 700; color: #9d3d00; margin-bottom: 6px; }
.pa-extract-module-content { font-size: 12px; color: #5a5c5b; line-height: 1.6; white-space: pre-wrap; }
</style>

<canvas id="paSprite" width="${10 * PX}" height="${16 * PX}"></canvas>
<div id="paBubble"></div>

<div id="paWindow" class="hidden">
  <div id="paHeader">
    <div>
      <div class="pa-title">🎯 求职小助手</div>
      <div class="pa-subtitle">小逮 · 帮你找到最合适的岗位</div>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="paExpandBtn" title="展开全屏">⛶</button>
      <button id="paCloseBtn">×</button>
    </div>
  </div>
  <div id="paMessages"></div>
  <div id="paRecommendSection" class="hidden">
    <div style="font-size:11px;font-weight:700;color:#9d3d00;margin-bottom:6px;">为你推荐的岗位</div>
    <div id="paJobList"></div>
  </div>
  <div id="paSaveResumeArea" class="hidden" style="padding: 0 12px 8px; flex-shrink: 0;">
    <button id="paSaveResumeBtn">💾 保存到简历模块</button>
  </div>
  <div id="paInputArea">
    <textarea id="paInput" rows="1" placeholder="和小逮聊聊你的情况…"></textarea>
    <button id="paSendBtn">
      <span class="material-symbols-outlined" style="font-size:18px;">send</span>
    </button>
  </div>
</div>

<div id="paExtractOverlay" class="hidden">
  <div id="paExtractModal">
    <div style="font-size:15px;font-weight:700;color:#2d2f2e;margin-bottom:12px;">从对话中提取到以下信息</div>
    <div id="paExtractList"></div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      <button id="paExtractConfirmBtn" style="flex:1;padding:10px;background:#9d3d00;color:white;border:none;border-radius:10px;cursor:pointer;font-size:13px;">保存选中项</button>
      <button id="paExtractCancelBtn" style="flex:1;padding:10px;background:#f0f1ef;color:#2d2f2e;border:none;border-radius:10px;cursor:pointer;font-size:13px;">取消</button>
    </div>
  </div>
</div>
`;
  document.body.appendChild(el);
  return el;
}

export function initPixelAssistant() {
  const el = createAssistantDOM();
  const canvas = document.getElementById('paSprite');
  const ctx = canvas.getContext('2d');
  const bubble = document.getElementById('paBubble');
  const win = document.getElementById('paWindow');
  const messages = document.getElementById('paMessages');
  const input = document.getElementById('paInput');
  const sendBtn = document.getElementById('paSendBtn');
  const recommendSection = document.getElementById('paRecommendSection');
  const jobList = document.getElementById('paJobList');

  // ── Invite code check ─────────────────────────────────────────────────────
  let inviteVerified = localStorage.getItem('yesjob_ai_invite_verified') === 'true';

  async function checkInviteCode() {
    if (inviteVerified) return true;

    const code = prompt('🎯 使用 AI 功能需要邀请码\n\n请输入邀请码：');
    if (!code) return false;

    try {
      const response = await fetch('/api/ai/verify-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('yesjob_token')}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.detail || '邀请码验证失败');
        return false;
      }

      inviteVerified = true;
      localStorage.setItem('yesjob_ai_invite_verified', 'true');
      return true;
    } catch (err) {
      alert('验证失败：' + err.message);
      return false;
    }
  }

  // ── Sprite animation ──────────────────────────────────────────────────────
  let spriteState = 'idle'; // idle | talking | thinking
  let frame = 0;
  let bobOffset = 0;
  let bobDir = 1;

  function animateSprite() {
    frame++;
    if (spriteState === 'idle') {
      if (frame % 20 === 0) { bobOffset += bobDir; if (Math.abs(bobOffset) >= 1) bobDir *= -1; }
      drawSprite(ctx, SPRITE_IDLE, bobOffset);
    } else if (spriteState === 'talking') {
      drawSprite(ctx, frame % 6 < 3 ? SPRITE_TALK : SPRITE_IDLE, 0);
    } else {
      drawSprite(ctx, SPRITE_IDLE, 0);
    }
    requestAnimationFrame(animateSprite);
  }
  animateSprite();

  // ── Bubble ────────────────────────────────────────────────────────────────
  let bubbleTimer = null;
  function showBubble(text, duration = 3000) {
    bubble.textContent = text;
    bubble.classList.add('visible');
    clearTimeout(bubbleTimer);
    if (duration > 0) bubbleTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
  }

  // ── Toggle window ─────────────────────────────────────────────────────────
  let isOpen = false;
  canvas.addEventListener('click', async () => {
    if (spriteDragging) return;
    if (!isOpen && !inviteVerified) {
      const verified = await checkInviteCode();
      if (!verified) return;
    }
    isOpen = !isOpen;
    win.classList.toggle('hidden', !isOpen);
    if (isOpen && messages.children.length === 0) {
      addBotMessage('你好！我是小逮，你的求职小助手 🎯\n先聊聊你的情况吧，比如你在找什么方向的岗位？');
      spriteState = 'talking';
      setTimeout(() => { spriteState = 'idle'; }, 2000);
    }
    bubble.classList.remove('visible');
  });
  document.getElementById('paCloseBtn').addEventListener('click', () => {
    isOpen = false;
    win.classList.add('hidden');
  });

  let isFullscreen = false;
  const expandBtn = document.getElementById('paExpandBtn');
  expandBtn.addEventListener('click', () => {
    isFullscreen = !isFullscreen;
    win.classList.toggle('fullscreen', isFullscreen);
    expandBtn.textContent = isFullscreen ? '✕' : '⛶';
    expandBtn.title = isFullscreen ? '退出全屏' : '展开全屏';
    messages.scrollTop = messages.scrollHeight;
  });

  // ── Sprite drag ───────────────────────────────────────────────────────────
  let spriteDragging = false;
  let spriteDragStartX = 0, spriteDragStartY = 0;
  let spriteStartLeft = 0, spriteStartBottom = 0;
  const assistant = document.getElementById('pixelAssistant');

  canvas.addEventListener('mousedown', e => {
    spriteDragStartX = e.clientX;
    spriteDragStartY = e.clientY;
    const rect = assistant.getBoundingClientRect();
    spriteStartLeft = rect.left;
    spriteStartBottom = window.innerHeight - rect.bottom;
    spriteDragging = false;
  });

  document.addEventListener('mousemove', e => {
    if (e.buttons !== 1 || (spriteDragStartX === 0 && spriteDragStartY === 0)) return;
    const dx = e.clientX - spriteDragStartX, dy = e.clientY - spriteDragStartY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      spriteDragging = true;
      const newLeft = Math.max(0, Math.min(spriteStartLeft + dx, window.innerWidth - 48));
      const newBottom = Math.max(0, Math.min(spriteStartBottom - dy, window.innerHeight - 72));
      assistant.style.left = newLeft + 'px';
      assistant.style.right = 'auto';
      assistant.style.bottom = newBottom + 'px';
    }
  });

  document.addEventListener('mouseup', () => { spriteDragStartX = 0; spriteDragStartY = 0; });

  // ── Drag ──────────────────────────────────────────────────────────────────
  const header = document.getElementById('paHeader');
  let dragging = false, dragStartX = 0, dragStartY = 0, winStartX = 0, winStartY = 0;
  header.addEventListener('mousedown', e => {
    dragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    const rect = win.getBoundingClientRect();
    winStartX = rect.left; winStartY = rect.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    win.style.left = `${winStartX + dx}px`;
    win.style.top = `${winStartY + dy}px`;
    win.style.right = 'auto';
    win.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });

  // ── Messages ──────────────────────────────────────────────────────────────
  function addBotMessage(text) {
    const div = document.createElement('div');
    div.className = 'pa-msg bot';
    div.innerHTML = `<div class="pa-msg-avatar">🤖</div><div class="pa-msg-bubble">${escText(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div.querySelector('.pa-msg-bubble');
  }

  function addUserMessage(text) {
    const div = document.createElement('div');
    div.className = 'pa-msg user';
    div.innerHTML = `<div class="pa-msg-bubble">${escText(text)}</div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addTypingIndicator() {
    const div = document.createElement('div');
    div.className = 'pa-msg bot';
    div.id = 'paTyping';
    div.innerHTML = `<div class="pa-msg-avatar">🤖</div><div class="pa-msg-bubble pa-typing"><span></span><span></span><span></span></div>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function escText(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  // ── Build resume context ──────────────────────────────────────────────────
  function buildResumeContext() {
    const raw = localStorage.getItem('yesjob_resume_modules');
    if (!raw) return '';
    try {
      const modules = JSON.parse(raw);
      if (!modules || modules.length === 0) return '';
      const lines = [];
      for (const m of modules) {
        const d = m.data || {};
        if (m.type === 'basic') {
          lines.push(`基本信息：${d.name || ''} ${d.phone || ''} ${d.email || ''}`);
        } else if (m.type === 'education') {
          lines.push(`教育经历：${d.school || ''} ${d.degree || ''} ${d.major || ''} ${d.graduation || ''}`);
        } else if (m.type === 'experience') {
          lines.push(`工作经历：${d.company || ''} ${d.position || ''} ${d.period || ''} ${d.description || ''}`);
        } else if (m.type === 'project') {
          lines.push(`项目经历：${d.name || ''} ${d.role || ''} ${d.period || ''} ${d.description || ''}`);
        } else if (m.type === 'skill') {
          lines.push(`技能：${d.category || ''} ${(d.items || []).join(', ')}`);
        }
      }
      return lines.join('\n');
    } catch {
      return '';
    }
  }

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    input.style.height = 'auto';
    addUserMessage(text);
    sendBtn.disabled = true;
    spriteState = 'thinking';

    const typing = addTypingIndicator();

    try {
      const token = localStorage.getItem('yesjob_token');
      if (!token) {
        typing.remove();
        addBotMessage('请先登录才能使用小助手哦～');
        spriteState = 'idle';
        sendBtn.disabled = false;
        return;
      }

      // Check if user wants to optimize resume for selected job
      const selectedJobId = input.dataset.selectedJobId;
      const isOptimizeIntent = /^(是|好|好的|可以|优化|帮我优化)/.test(text);
      if (selectedJobId && isOptimizeIntent) {
        delete input.dataset.selectedJobId;
        const resp = await fetch('/api/ai/analyze-job-fit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ job_id: parseInt(selectedJobId) }),
        });
        if (!resp.ok) {
          typing.remove();
          addBotMessage('分析失败，请稍后再试。');
          spriteState = 'idle';
          sendBtn.disabled = false;
          return;
        }
        typing.remove();
        const bubble = addBotMessage('');
        spriteState = 'talking';
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop();
          for (const line of lines) {
            const t = line.trim();
            if (!t || t === 'data: [DONE]') continue;
            if (!t.startsWith('data: ')) continue;
            try {
              const json = JSON.parse(t.slice(6));
              if (json.content) {
                bubble.innerHTML += escText(json.content);
                messages.scrollTop = messages.scrollHeight;
              }
            } catch {}
          }
        }
        spriteState = 'idle';
        sendBtn.disabled = false;
        return;
      }

      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          context: messages.querySelectorAll('.pa-msg.user').length <= 1 ? buildResumeContext() : '',
        }),
      });

      if (!resp.ok) {
        typing.remove();
        const error = await resp.json().catch(() => ({}));
        if (resp.status === 403 && error.detail?.includes('邀请码')) {
          inviteVerified = false;
          localStorage.removeItem('yesjob_ai_invite_verified');
          addBotMessage('需要邀请码才能使用 AI 功能，请重新打开对话框输入邀请码。');
        } else {
          addBotMessage('出错了，请稍后再试。');
        }
        spriteState = 'idle';
        sendBtn.disabled = false;
        return;
      }

      typing.remove();
      const bubble = addBotMessage('');
      spriteState = 'talking';
      let profileReady = false;

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (!t.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(t.slice(6));
            if (json.content) {
              bubble.innerHTML += escText(json.content);
              messages.scrollTop = messages.scrollHeight;
            }
            if (json.profile_ready) {
              profileReady = true;
              console.log('[AI] Profile ready signal received');
            }
          } catch {}
        }
      }

      spriteState = 'idle';
      if (profileReady) {
        console.log('[AI] Triggering job recommendations...');
        document.getElementById('paSaveResumeArea').classList.remove('hidden');
        setTimeout(() => loadRecommendations(), 500);
      }
    } catch (e) {
      typing.remove();
      addBotMessage('网络错误，请检查连接。');
      spriteState = 'idle';
    }
    sendBtn.disabled = false;
  }

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  // ── Save to resume ────────────────────────────────────────────────────────
  const MODULE_TYPE_LABELS = {
    basic: '基本信息', education: '教育经历', experience: '工作经历',
    project: '项目经历', skill: '技能'
  };

  function formatModulePreview(module) {
    const d = module.data || {};
    if (module.type === 'basic') return `${d.name || ''} ${d.phone || ''} ${d.email || ''} ${d.location || ''}`.trim();
    if (module.type === 'education') return `${d.school || ''} ${d.degree || ''} ${d.major || ''} ${d.graduation || ''}`.trim();
    if (module.type === 'experience') return `${d.company || ''} ${d.position || ''}\n${d.period || ''}\n${d.description || ''}`.trim();
    if (module.type === 'project') return `${d.name || ''} ${d.role || ''}\n${d.period || ''}\n${d.description || ''}`.trim();
    if (module.type === 'skill') return `${d.category || ''}: ${(d.items || []).join(', ')}`.trim();
    return '';
  }

  document.getElementById('paSaveResumeBtn').addEventListener('click', async () => {
    const token = localStorage.getItem('yesjob_token');
    if (!token) { addBotMessage('请先登录'); return; }
    try {
      const resp = await fetch('/api/ai/extract-resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      if (!resp.ok) { addBotMessage('提取失败，请稍后再试'); return; }
      const { modules } = await resp.json();
      if (!modules || modules.length === 0) { addBotMessage('没有提取到简历信息，请继续和我聊聊～'); return; }
      const overlay = document.getElementById('paExtractOverlay');
      const list = document.getElementById('paExtractList');
      list.innerHTML = modules.map((m, i) => `
        <div class="pa-extract-module">
          <label>
            <input type="checkbox" checked data-index="${i}">
            <div style="flex:1;">
              <div class="pa-extract-module-title">${MODULE_TYPE_LABELS[m.type] || m.type}</div>
              <div class="pa-extract-module-content">${escText(formatModulePreview(m))}</div>
            </div>
          </label>
        </div>
      `).join('');
      overlay.classList.remove('hidden');
      overlay._modules = modules;
    } catch (e) { addBotMessage('提取失败：' + e.message); }
  });

  document.getElementById('paExtractConfirmBtn').addEventListener('click', () => {
    const overlay = document.getElementById('paExtractOverlay');
    const modules = overlay._modules || [];
    let saved = 0;
    overlay.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
      if (cb.checked && modules[i] && window.ResumeStore) {
        try { window.ResumeStore.addModule(modules[i].type, modules[i].data); saved++; } catch {}
      }
    });
    overlay.classList.add('hidden');
    if (saved > 0) addBotMessage(`已保存 ${saved} 个模块到简历！可在简历管理页面查看。`);
  });

  document.getElementById('paExtractCancelBtn').addEventListener('click', () => {
    document.getElementById('paExtractOverlay').classList.add('hidden');
  });

  // ── Job recommendations ───────────────────────────────────────────────────
  async function loadRecommendations() {
    const token = localStorage.getItem('yesjob_token');
    if (!token) return;
    console.log('[AI] Fetching job recommendations...');
    try {
      const resp = await fetch('/api/ai/recommend-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ top_k: 5 }),
      });
      if (!resp.ok) {
        console.error('[AI] Recommend API failed:', resp.status);
        return;
      }
      const data = await resp.json();
      console.log('[AI] Received recommendations:', data.jobs?.length || 0);
      if (!data.jobs?.length) return;

      jobList.innerHTML = data.jobs.map((j, i) => `
        <div class="pa-job-card" data-id="${j.id}">
          <div class="pa-job-card-rank">${i + 1}</div>
          <div class="pa-job-card-body">
            <div class="pa-job-title">${escText(j.title || '')}</div>
            <div class="pa-job-company">${escText(j.company || '')}</div>
            <div class="pa-job-meta">
              <span>${escText(j.work_city || '')}</span>
              <span>${escText(j.recruit_type || '')}</span>
              <span>${escText(j.job_category || '')}</span>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">
            <span class="pa-job-arrow">›</span>
            <button class="pa-job-optimize-btn" data-id="${j.id}" data-title="${escText(j.title || '')}" data-company="${escText(j.company || '')}">优化简历</button>
          </div>
        </div>
      `).join('');

      recommendSection.classList.remove('hidden');
      addBotMessage('根据你的情况，为你推荐了 ' + data.jobs.length + ' 个岗位，点击卡片查看详情 👇');
      messages.scrollTop = messages.scrollHeight;

      jobList.querySelectorAll('.pa-job-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.classList.contains('pa-job-optimize-btn')) {
            e.stopPropagation();
            const btn = e.target;
            const jobId = btn.dataset.id;
            const title = btn.dataset.title;
            const company = btn.dataset.company;
            startResumeOptimization(jobId, title, company);
          } else {
            const id = card.dataset.id;
            window.open(`/pages/job-detail.html?id=${id}`, '_blank');
          }
        });
      });
    } catch {}
  }

  async function startResumeOptimization(jobId, title, company) {
    addBotMessage(`正在为你分析「${company} - ${title}」的简历优化建议...`);
    spriteState = 'thinking';
    const typing = addTypingIndicator();
    try {
      const token = localStorage.getItem('yesjob_token');
      const resp = await fetch('/api/ai/analyze-job-fit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ job_id: parseInt(jobId) }),
      });
      if (!resp.ok) {
        typing.remove();
        addBotMessage('分析失败，请稍后再试。');
        spriteState = 'idle';
        return;
      }
      typing.remove();
      const bubble = addBotMessage('');
      spriteState = 'talking';
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const t = line.trim();
          if (!t || t === 'data: [DONE]') continue;
          if (!t.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(t.slice(6));
            if (json.content) {
              bubble.innerHTML += escText(json.content);
              messages.scrollTop = messages.scrollHeight;
            }
          } catch {}
        }
      }
      spriteState = 'idle';
    } catch (e) {
      typing.remove();
      addBotMessage('网络错误，请检查连接。');
      spriteState = 'idle';
    }
  }

  // ── Idle bubble hints ─────────────────────────────────────────────────────
  const hints = ['有什么我能帮你的？', '点我聊聊求职吧～', '找工作，找小逮！'];
  let hintIdx = 0;
  setInterval(() => {
    if (!isOpen) {
      showBubble(hints[hintIdx % hints.length], 2500);
      hintIdx++;
    }
  }, 15000);
}
