const API = '/api/chat';
let sessionId = null;
let waiting = false;

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatOptions = document.getElementById('chat-options');
const inputWrap = document.getElementById('chat-input-wrap');
const resetBtn = document.getElementById('reset-btn');

async function sendMessage(message) {
  if (waiting) return;
  waiting = true;
  setLoading(true);

  addMessage(message, 'user');
  chatInput.value = '';
  showTyping();

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    sessionId = data.sessionId;
    removeTyping();
    handleResponse(data);
  } catch (err) {
    removeTyping();
    addMessage('Lo siento, hubo un error. Intenta de nuevo.', 'bot');
  } finally {
    waiting = false;
    setLoading(false);
  }
}

async function sendOption(optionId, label) {
  if (waiting) return;
  waiting = true;
  setLoading(true);

  addMessage(label, 'user');
  clearOptions();
  showTyping();

  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, optionId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    sessionId = data.sessionId;
    removeTyping();
    handleResponse(data);
  } catch (err) {
    removeTyping();
    addMessage('Lo siento, hubo un error. Intenta de nuevo.', 'bot');
  } finally {
    waiting = false;
    setLoading(false);
  }
}

function handleResponse(data) {
  addMessage(data.response, 'bot');

  if (data.linkButton) {
    renderLinkButton(data.linkButton);
  }

  if (data.next === 'end') {
    clearOptions();
    inputWrap.style.display = 'none';
    return;
  }

  if (data.next === 'input') {
    clearOptions();
    inputWrap.style.display = 'flex';
    chatInput.focus();
    return;
  }

  if (data.next === 'options' && data.options) {
    inputWrap.style.display = 'none';
    renderOptions(data.options);
  }
}

function renderOptions(options) {
  clearOptions();
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt.label;
    btn.onclick = () => sendOption(opt.id, opt.label);
    chatOptions.appendChild(btn);
  });
}

function renderLinkButton(link) {
  const wrap = document.createElement('div');
  wrap.className = 'link-btn-wrap';
  const btn = document.createElement('a');
  btn.className = 'link-btn';
  btn.href = link.url;
  btn.target = '_blank';
  btn.rel = 'noopener noreferrer';
  btn.textContent = link.label;
  wrap.appendChild(btn);
  chatMessages.appendChild(wrap);
  scrollBottom();
}

function clearOptions() {
  chatOptions.innerHTML = '';
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';
  bubble.innerHTML = text.replace(/\n/g, '<br>');
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  scrollBottom();
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
  chatMessages.appendChild(div);
  scrollBottom();
}

function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

function scrollBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoading(loading) {
  chatInput.disabled = loading;
  chatSend.disabled = loading;
}

function resetChat() {
  sessionId = null;
  waiting = false;
  chatMessages.innerHTML = '';
  clearOptions();
  inputWrap.style.display = 'flex';
  chatInput.disabled = false;
  chatSend.disabled = false;
  chatInput.value = '';
  startChat();
}

function startChat() {
  showTyping();
  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'start' }),
  })
    .then(r => r.json())
    .then(data => {
      sessionId = data.sessionId;
      removeTyping();
      handleResponse(data);
    })
    .catch(() => {
      removeTyping();
      addMessage('Bienvenido. ¿En qué puedo ayudarte?', 'bot');
    });
}

chatSend.addEventListener('click', () => {
  const msg = chatInput.value.trim();
  if (msg) sendMessage(msg);
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const msg = chatInput.value.trim();
    if (msg) sendMessage(msg);
  }
});

resetBtn.addEventListener('click', resetChat);

document.addEventListener('DOMContentLoaded', startChat);
