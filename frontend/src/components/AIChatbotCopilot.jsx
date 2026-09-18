import React, { useEffect, useRef, useState } from 'react';
import { GEMINI_API_KEY, GEMINI_MODEL, API_BASE_URL } from '../config';

const SYSTEM_PROMPT = `
You are "Raakshak AI" — the multilingual multi-hazard safety copilot of a Multi-Hazard
Monitoring System covering Flood / Urban Waterlogging, Earthquake / Seismic Activity,
Cyclone / Heavy Winds, Heatwave, Tsunami, and Landslide.

## Language behavior (CRITICAL)
- Detect the language of the user's latest message: English, Hindi (हिन्दी), Hinglish,
  Tamil, Bengali, Telugu, Marathi, Gujarati, Urdu, Punjabi, Malayalam, Kannada, Odia, or
  any other regional language/dialect.
- ALWAYS reply fluently in the SAME language/dialect the user used. For Hinglish, mirror
  their mix of Devanagari/Roman script naturally.
- If the user mixes languages, mirror their mix accordingly.
- Keep answers clear, practical, and appropriately concise.

## Role & scope
- Answer general queries AND multi-hazard emergency safety questions (Earthquake, Flood,
  Cyclone, Heatwave, Tsunami, Landslide, Urban Waterlogging).
- Give actionable step-by-step safety protocols, e.g.:
  * Earthquake: Drop, Cover & Hold On; stay away from windows; expect aftershocks.
  * Flood: move to higher ground immediately; never walk/drive through flood water; avoid
    submerged electrical wires; turn off gas/electricity.
  * Cyclone: secure/board windows, store drinking water & essentials, heed evacuation
    orders, stay indoors away from glass.
  * Heatwave: hydrate, avoid direct sun between 12-4 PM, recognize heatstroke signs.
- Mention official helplines where relevant (e.g., NDRF 011-24363260, emergency helpline
  112) and always advise contacting local authorities for live evacuation orders.
- Never fabricate live sensor readings or location-specific data; use general knowledge only.
- Be reassuring and decisive. Never give medical or legal advice; defer to professionals
  when unsure.
`;

const CTA_OPTIONS = [
  'भूकंप में क्या करें?',
  'Flood safety tips',
  'Cyclone preparedness',
  'हीटवेव से बचाव के तरीके'
];

const AIChatbotCopilot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Namaste! 🙏 I am Raakshak AI, your multilingual multi-hazard safety copilot. Ask me in English, हिन्दी, Hinglish or any regional language about Earthquake, Flood, Cyclone or Heatwave safety.' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const classifyError = (err) => {
    if (err && err.code === 'MISSING_KEY') {
      return '⚠️ Gemini API key is missing. Add REACT_APP_GEMINI_API_KEY (frontend) or GEMINI_API_KEY (backend) to the .env files and restart the app.';
    }
    if (err && err.code === 'NETWORK') {
      return '⚠️ Could not reach the AI service. Please check your internet connection and try again.';
    }
    if (err && err.httpStatus === 429) {
      return '⚠️ AI service is rate-limited (429). Please wait a moment and try again.';
    }
    if (err && (err.httpStatus === 400 || err.httpStatus === 403)) {
      return `⚠️ AI request rejected by the API (HTTP ${err.httpStatus}). Please verify the Gemini API key and model.`;
    }
    return `⚠️ Something went wrong: ${err ? err.message : 'Unknown error'}`;
  };

  const callGeminiDirect = async (history) => {
    const recent = history.slice(-12);
    const contents = recent.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}` +
      `:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.4,
            candidateCount: 1,
            maxOutputTokens: 900
          }
        })
      });
    } catch (networkErr) {
      const n = new Error('Network request failed');
      n.code = 'NETWORK';
      throw n;
    }

    if (!res.ok) {
      const perr = new Error(`HTTP ${res.status}`);
      perr.httpStatus = res.status;
      throw perr;
    }

    const data = await res.json().catch(() => ({}));
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text || '')
      .join('')
      .trim();

    if (!text) {
      throw new Error('Empty response from AI service');
    }
    return text;
  };

  const callBackendChat = async (history) => {
    const recent = history.slice(-8);
    const mapped = recent.map((m) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      content: m.text
    }));
    const lastUser = mapped.pop();
    const message = lastUser ? lastUser.content : '';

    let res;
    try {
      res = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          lang: 'en-US',
          history: mapped,
          systemPrompt: SYSTEM_PROMPT
        })
      });
    } catch (networkErr) {
      const n = new Error('Network request failed');
      n.code = 'NETWORK';
      throw n;
    }

    if (!res.ok) {
      const perr = new Error(`HTTP ${res.status}`);
      perr.httpStatus = res.status;
      throw perr;
    }

    const data = await res.json().catch(() => ({}));
    const reply = (data?.reply || '').trim();
    if (!reply) {
      throw new Error('Empty response from backend AI service');
    }
    return reply;
  };

  const callGemini = async (history) => {
    if (!GEMINI_API_KEY) {
      return callBackendChat(history);
    }

    try {
      return await callGeminiDirect(history);
    } catch (directErr) {
      try {
        return await callBackendChat(history);
      } catch (backendErr) {
        if (
          directErr?.code === 'MISSING_KEY' ||
          directErr?.httpStatus === 400 ||
          directErr?.httpStatus === 401 ||
          directErr?.httpStatus === 403
        ) {
          throw directErr;
        }
        throw backendErr;
      }
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    const text = inputVal.trim();
    if (!text || thinking) return;

    setError(null);
    const userMsg = { sender: 'user', text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInputVal('');

    setThinking(true);
    try {
      const reply = await callGemini(history);
      setMessages((prev) => [...prev, { sender: 'ai', text: reply }]);
    } catch (err) {
      const friendly = classifyError(err);
      setError(friendly);
      setMessages((prev) => [...prev, { sender: 'error', text: friendly }]);
    } finally {
      setThinking(false);
    }
  };

  const handleQuickPrompt = (text) => {
    setInputVal(text);
  };

  return (
    <>
      <style>{`
        @keyframes mh-bot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.45); }
          70% { box-shadow: 0 0 0 16px rgba(6, 182, 212, 0); }
          100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
        }
        @keyframes mh-bot-dot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes mh-bot-pop {
          from { opacity: 0; transform: translateY(10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mh-bot-fade-in {
          from { opacity: 0; transform: translate(-50%, 50%); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .mh-bot-msg { animation: mh-bot-fade-in 0.25s ease-out; }
        .mh-bot-window { animation: mh-bot-pop 0.22s ease-out; }
      `}</style>

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="mh-bot-window" style={{
          position: 'fixed',
          bottom: '92px',
          right: '24px',
          width: 'min(92vw, 380px)',
          height: 'min(72vh, 540px)',
          background: '#0f172a',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          borderRadius: '18px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 99999,
          color: '#f8fafc'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #0e7490, #0369a1)',
            borderBottom: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '50%',
                background: '#020617', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '20px'
              }}>🤖</div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>Raakshak AI Copilot</div>
                <div style={{ fontSize: '11px', color: '#a5f3fc', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                  Online • 🌐 Multilingual (हिन्दी • Hinglish • English)
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close chatbot"
              style={{
                background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff',
                width: '30px', height: '30px', borderRadius: '50%',
                cursor: 'pointer', fontSize: '15px', fontWeight: 'bold'
              }}
            >✕</button>
          </div>

          {/* Messages */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              background: '#020617'
            }}
          >
            {messages.map((msg, idx) => {
              if (msg.sender === 'user') {
                return (
                  <div key={idx} className="mh-bot-msg" style={{
                    alignSelf: 'flex-end',
                    maxWidth: '82%',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#fff',
                    padding: '9px 13px',
                    borderRadius: '14px 14px 3px 14px',
                    fontSize: '13.5px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>{msg.text}</div>
                );
              }
              return (
                <div key={idx} className="mh-bot-msg" style={{
                  alignSelf: 'flex-start',
                  maxWidth: '85%',
                  background: msg.sender === 'error' ? 'rgba(239, 68, 68, 0.18)' : '#1e293b',
                  border: msg.sender === 'error' ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid #334155',
                  color: msg.sender === 'error' ? '#fca5a5' : '#e2e8f0',
                  padding: '9px 13px',
                  borderRadius: '14px 14px 14px 3px',
                  fontSize: '13.5px',
                  lineHeight: '1.55',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>{msg.text}</div>
              );
            })}

            {thinking && (
              <div className="mh-bot-msg" style={{
                alignSelf: 'flex-start',
                background: '#1e293b',
                border: '1px solid #334155',
                padding: '12px 16px',
                borderRadius: '14px 14px 14px 3px',
                display: 'flex',
                gap: '5px'
              }}>
                {[0, 1, 2].map((d) => (
                  <span key={d} style={{
                    width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8',
                    display: 'inline-block',
                    animation: 'mh-bot-dot 1.1s infinite ease-in-out',
                    animationDelay: `${d * 0.16}s`
                  }} />
                ))}
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div style={{
            display: 'flex', gap: '6px', overflowX: 'auto', padding: '8px 12px 0',
            background: '#020617', scrollbarWidth: 'none'
          }}>
            {CTA_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => handleQuickPrompt(opt)}
                style={{
                  flexShrink: 0,
                  background: 'rgba(56, 189, 248, 0.1)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  color: '#7dd3fc',
                  borderRadius: '14px',
                  padding: '5px 11px',
                  fontSize: '11.5px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap'
                }}
              >{opt}</button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#0f172a', borderTop: '1px solid #1e293b' }}>
            <input
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Ask in any language… (e.g., भूकंप में क्या करें?)"
              style={{
                flex: 1,
                background: '#020617',
                border: '1px solid #334155',
                borderRadius: '10px',
                padding: '10px 13px',
                color: '#fff',
                fontSize: '13px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || thinking}
              style={{
                background: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                padding: '10px 16px',
                fontWeight: 'bold',
                cursor: thinking ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                opacity: !inputVal.trim() ? 0.5 : 1
              }}
            >➤ Send</button>
          </form>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        className="mh-bot-fab"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open AI chatbot"
        style={{
          position: 'fixed',
          bottom: '22px',
          right: '24px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #0891b2, #0369a1)',
          border: '2px solid rgba(255,255,255,0.25)',
          color: '#fff',
          fontSize: '27px',
          cursor: 'pointer',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'mh-bot-pulse 2.4s infinite'
        }}
      >
        {isOpen ? '✕' : '🤖'}
        {!isOpen && (
          <span style={{
            position: 'absolute', top: '-2px', right: '-2px', width: '13px', height: '13px',
            borderRadius: '50%', background: '#4ade80', border: '2px solid #020617'
          }} />
        )}
      </button>
    </>
  );
};

export default AIChatbotCopilot;