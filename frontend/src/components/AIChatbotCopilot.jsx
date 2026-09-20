import React, { useEffect, useRef, useState } from 'react';
import { GEMINI_API_KEY, GEMINI_MODEL, API_BASE_URL } from '../config';

const SYSTEM_PROMPT = (contextData = {}) => `
YOU ARE STRUCT AI COPILOT, A REAL-TIME MULTI-HAZARD DISASTER AND STRUCTURAL HEALTH ASSISTANT EMBEDDED IN THIS DASHBOARD.
YOU HAVE ACCESS TO LIVE REAL-TIME SENSOR AND HAZARD TELEMETRY DATA BELOW:

LIVE SYSTEM CONTEXT:
${JSON.stringify(contextData || {}, null, 2)}

STRICT LANGUAGE & IDENTITY RULES:
- Your name is STRUCT AI COPILOT.
- Speak ONLY in English or Hinglish (Hindi written in Roman/English script, e.g., "Main aapko live data ke basis par bata raha hu").
- NEVER use Devanagari script (DO NOT write in "हिंदी" script like "जानकारी नहीं दे सकता").
- Keep the tone casual, respectful, professional, and friendly.

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
- Always analyze the LIVE SYSTEM CONTEXT above to answer queries regarding flood levels,
  wind speeds, cyclone alerts, earthquake updates, or structural asset health.
- NEVER say "I don't have access to real-time data". You DO have live access via contextData.
- Provide clear risk predictions and immediate safety steps based on live telemetry numbers.
- Be reassuring and decisive. Never give medical or legal advice; defer to professionals
  when unsure.
`;

const CTA_OPTIONS = [
  'Earthquake mein kya karein?',
  'Flood safety tips',
  'Cyclone preparedness',
  'Heatwave se bachav ke tarike'
];

const FEMALE_VOICE_HINTS = ['swara', 'heera', 'neerja', 'kalpana', 'priya', 'rani', 'pooja', 'zira', 'cortana', 'female', 'woman', 'girl', 'हिन्दी', 'हिंदी'];
const MALE_VOICE_HINTS = ['hemant', 'ravi', 'david', 'mark', 'james ', 'george', 'daniel', 'alex', 'fred', 'male', 'guy', 'man voice'];

const AIChatbotCopilot = ({ contextData }) => {
  const liveContext = (typeof contextData === 'object' && contextData !== null) ? contextData : {};

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Namaste! 🙏 I am Struct AI Copilot, your real-time multi-hazard disaster & structural health assistant. Ask me in English or Hinglish about live flood, cyclone, earthquake or asset sensor telemetry.' }
  ]);
  const [inputVal, setInputVal] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const voicesRef = useRef([]);
  const restartRef = useRef(null);
  const messagesRef = useRef(messages);
  const voiceModeRef = useRef(false);
  const listeningRef = useRef(false);
  const speakingRef = useRef(false);
  const thinkingRef = useRef(false);
  const sendQueryRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, thinking, isOpen]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      clearTimeout(restartRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    };
  }, []);

  const isFemale = (name) => FEMALE_VOICE_HINTS.some((h) => name.toLowerCase().includes(h));
  const isMale = (name) => MALE_VOICE_HINTS.some((h) => name.toLowerCase().includes(h));
  const isHQ = (name) => /natural|online|neural|google/i.test(name);

  const isHindi = (lang) => {
    const l = (lang || '').toLowerCase();
    return l === 'hi-in' || l.startsWith('hi');
  };

  const pickFemaleVoice = () => {
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const hindiVoices = voices.filter((v) => isHindi(v.lang));
    const pool = hindiVoices.length ? hindiVoices : voices;
    const hasHindi = hindiVoices.length > 0;
    const score = (v) => {
      const name = (v.name || '').toLowerCase();
      const lang = (v.lang || '').toLowerCase();
      let s = 0;
      if (isMale(name)) s -= 1000;
      if (isFemale(name)) s += 50;
      if (/swara|हिन्दी|हिंदी|heera|neerja|kalpana|priya|rani|pooja/i.test(name)) s += 25;
      if (isHQ(name)) s += 10;
      if (lang.startsWith('hi')) s += 30;
      else if (lang.startsWith('en-in')) s += 12;
      else if (lang.startsWith('en')) s += 5;
      if (v.default) s += 2;
      if (!hasHindi && !/^hi/.test(lang)) s -= 20;
      return s;
    };
    return [...pool].sort((a, b) => score(b) - score(a))[0];
  };

  const speakText = (text) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const readable = String(text || '')
      .replace(/[#*`_~>|]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!readable) return;
    const utterance = new SpeechSynthesisUtterance(readable);
    const voice = pickFemaleVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = 'hi-IN';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    utterance.onstart = () => { speakingRef.current = true; setSpeaking(true); };
    utterance.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);
      maybeResumeListening();
    };
    utterance.onerror = () => {
      speakingRef.current = false;
      setSpeaking(false);
      maybeResumeListening();
    };
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
  };

  const stopListening = () => {
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
    recognitionRef.current = null;
    listeningRef.current = false;
    setListening(false);
  };

  const maybeResumeListening = () => {
    if (!voiceModeRef.current) return;
    if (speakingRef.current || thinkingRef.current || listeningRef.current) return;
    clearTimeout(restartRef.current);
    restartRef.current = setTimeout(() => {
      if (voiceModeRef.current && !speakingRef.current && !thinkingRef.current) startListening();
    }, 650);
  };

  const startListening = () => {
    if (!voiceModeRef.current) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('⚠️ Voice input is not supported in this browser. Please use Chrome or Edge.');
      setVoiceMode(false);
      voiceModeRef.current = false;
      return;
    }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }

    const recognition = new SpeechRecognition();
    recognition.lang = 'hi-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => { listeningRef.current = true; setListening(true); };
    recognition.onerror = () => {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current = null;
      maybeResumeListening();
    };
    recognition.onend = () => {
      listeningRef.current = false;
      setListening(false);
      recognitionRef.current = null;
      maybeResumeListening();
    };
    recognition.onresult = (event) => {
      if (speakingRef.current || thinkingRef.current) return;
      let transcript = '';
      let finalDetected = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        transcript += res[0].transcript;
        if (res.isFinal) finalDetected = true;
      }
      if (transcript) setInputVal(transcript);
      if (finalDetected && transcript.trim()) {
        stopListening();
        const q = transcript.replace(/\s+/g, ' ').trim();
        if (sendQueryRef.current) sendQueryRef.current(q, { voice: true });
      }
    };

    try { recognition.start(); } catch (e) {}
  };

  const toggleVoice = () => {
    // Clicking while the assistant is speaking immediately mutes it and stops the mic.
    if (speakingRef.current) {
      stopSpeaking();
      stopListening();
      setVoiceMode(false);
      voiceModeRef.current = false;
      return;
    }
    if (voiceModeRef.current || listeningRef.current) {
      stopListening();
      setVoiceMode(false);
      voiceModeRef.current = false;
      return;
    }
    setError(null);
    setVoiceMode(true);
    voiceModeRef.current = true;
    startListening();
  };

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
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT(liveContext) }] },
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
          systemPrompt: SYSTEM_PROMPT(liveContext),
          contextData: liveContext
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

  const sendQuery = async (rawText, opts = {}) => {
    const text = String(rawText || '').trim();
    if (!text || thinkingRef.current) return;

    setError(null);
    thinkingRef.current = true;
    setThinking(true);

    const userMsg = { sender: 'user', text };
    const history = [...messagesRef.current, userMsg];
    messagesRef.current = history;
    setMessages(history);
    setInputVal('');

    try {
      const reply = await callGemini(history);
      if (opts.voice) {
        messagesRef.current = [...messagesRef.current, { sender: 'ai', text: reply }];
        setMessages(messagesRef.current);
        speakText(reply);
      } else {
        messagesRef.current = [...messagesRef.current, { sender: 'ai', text: reply }];
        setMessages(messagesRef.current);
      }
    } catch (err) {
      const friendly = classifyError(err);
      messagesRef.current = [...messagesRef.current, { sender: 'error', text: friendly }];
      setMessages(messagesRef.current);
      setError(friendly);
    } finally {
      thinkingRef.current = false;
      setThinking(false);
    }
  };
  sendQueryRef.current = sendQuery;

  const handleSend = (e) => {
    e.preventDefault();
    if (listeningRef.current) {
      stopListening();
    }
    // Text-mode rule: typed/sent messages never play audio.
    if (voiceModeRef.current) {
      setVoiceMode(false);
      voiceModeRef.current = false;
    }
    sendQuery(inputVal, { voice: false });
  };

  const handleQuickPrompt = (text) => {
    setInputVal(text);
    if (inputRef.current) inputRef.current.focus();
  };

  const headerSubStatus = speaking
    ? { label: '🔊 Speaking…', color: '#67e8f9' }
    : listening
      ? { label: '🎙️ Listening…', color: '#f87171' }
      : voiceMode
        ? { label: '● Live Voice Mode', color: '#4ade80' }
        : { label: '● Online • Live Telemetry • EN/Hinglish', color: '#4ade80' };

  const eqStyle = (d) => ({
    width: '3px',
    height: '14px',
    borderRadius: '2px',
    background: '#67e8f9',
    display: 'inline-block',
    animation: 'mh-eq 0.8s ease-in-out infinite',
    animationDelay: `${d}s`
  });

  return (
    <>
      <style>{`
        @keyframes mh-bot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.45); }
          70% { box-shadow: 0 0 0 16px rgba(6, 182, 212, 0); }
          100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0); }
        }
        @keyframes mh-bot-pop {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes mh-msg-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes mh-bot-dot {
          0%, 80%, 100% { transform: scale(0.55); opacity: 0.3; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes mh-eq {
          0%, 100% { height: 5px; }
          50% { height: 15px; }
        }
        @keyframes mh-ring-green {
          0% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.55); }
          70% { box-shadow: 0 0 0 11px rgba(34, 197, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
        @keyframes mh-ring-red {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.55); }
          70% { box-shadow: 0 0 0 11px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
        @keyframes mh-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes mh-fab-glow {
          0%, 100% { box-shadow: 0 8px 26px rgba(6, 182, 212, 0.45); }
          50% { box-shadow: 0 8px 34px rgba(168, 85, 247, 0.55); }
        }
        .mh-bot-msg { animation: mh-msg-in 0.22s ease-out; }
        .mh-bot-window { animation: mh-bot-pop 0.22s ease-out; }
        .mh-bot-scroll::-webkit-scrollbar { width: 5px; }
        .mh-bot-scroll::-webkit-scrollbar-thumb { background: rgba(56, 189, 248, 0.35); border-radius: 8px; }
        .mh-bot-scroll::-webkit-scrollbar-track { background: transparent; }
        .mh-bot-chips::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Floating Chat Window */}
      {isOpen && (
        <div className="mh-bot-window" style={{
          position: 'fixed',
          bottom: '92px',
          right: '24px',
          width: 'min(92vw, 390px)',
          height: 'min(74vh, 560px)',
          zIndex: 99999,
          borderRadius: '22px',
          padding: '1.5px',
          background: 'linear-gradient(160deg, rgba(103, 232, 249, 0.55), rgba(168, 85, 247, 0.35) 45%, rgba(56, 189, 248, 0.18))',
          boxShadow: '0 24px 70px rgba(2, 6, 23, 0.85), 0 0 45px rgba(56, 189, 248, 0.12)'
        }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            borderRadius: '20px',
            background: 'rgba(8, 13, 30, 0.86)',
            backdropFilter: 'blur(22px) saturate(140%)',
            WebkitBackdropFilter: 'blur(22px) saturate(140%)',
            color: '#f8fafc'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '13px 15px',
              background: 'linear-gradient(135deg, rgba(14, 116, 144, 0.5), rgba(2, 82, 118, 0.6) 45%, rgba(30, 27, 75, 0.55))',
              borderBottom: '1px solid rgba(148, 163, 184, 0.16)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                <div style={{ position: 'relative', width: '42px', height: '42px', flexShrink: 0 }}>
                  <div style={{
                    position: 'absolute',
                    inset: '-3px',
                    borderRadius: '50%',
                    background: 'conic-gradient(from 0deg, #22d3ee, #a855f7, #f472b6, #22d3ee)',
                    animation: 'mh-spin 4s linear infinite',
                    WebkitMask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))',
                    mask: 'radial-gradient(farthest-side, transparent calc(100% - 2.5px), #000 calc(100% - 2.5px))'
                  }} />
                  <div style={{
                    width: '38px',
                    height: '38px',
                    margin: '2px',
                    borderRadius: '50%',
                    background: 'rgba(2, 6, 23, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '19px'
                  }}>🛰️</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '800', color: '#fff', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>
                    Struct AI Copilot
                  </div>
                  <div style={{ fontSize: '10.5px', color: headerSubStatus.color, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600', letterSpacing: '0.02em' }}>
                    {speaking ? (
                      <>
                        <span style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '14px' }}>
                          <span style={eqStyle(0)} />
                          <span style={eqStyle(0.22)} />
                          <span style={eqStyle(0.44)} />
                          <span style={eqStyle(0.66)} />
                        </span>
                        <span className="mh-eq-label" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerSubStatus.label}</span>
                      </>
                    ) : (
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: headerSubStatus.color, marginRight: '5px', verticalAlign: 'middle', boxShadow: `0 0 8px ${headerSubStatus.color}` }} />
                        {headerSubStatus.label.replace('● ', '')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close chatbot"
                style={{
                  background: 'rgba(148, 163, 184, 0.14)',
                  border: '1px solid rgba(148, 163, 184, 0.22)',
                  color: '#e2e8f0',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  backdropFilter: 'blur(8px)',
                  flexShrink: 0
                }}
              >✕</button>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="mh-bot-scroll"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                background: 'transparent'
              }}
            >
              {messages.map((msg, idx) => {
                if (msg.sender === 'user') {
                  return (
                    <div key={idx} className="mh-bot-msg" style={{
                      alignSelf: 'flex-end',
                      maxWidth: '82%',
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.85), rgba(6, 182, 212, 0.75))',
                      border: '1px solid rgba(125, 211, 252, 0.25)',
                      color: '#fff',
                      padding: '9px 13px',
                      borderRadius: '15px 15px 4px 15px',
                      fontSize: '13.5px',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      boxShadow: '0 6px 18px rgba(37, 99, 235, 0.25)'
                    }}>{msg.text}</div>
                  );
                }
                return (
                  <div key={idx} className="mh-bot-msg" style={{
                    alignSelf: 'flex-start',
                    maxWidth: '85%',
                    background: msg.sender === 'error' ? 'rgba(239, 68, 68, 0.16)' : 'rgba(30, 41, 59, 0.55)',
                    border: msg.sender === 'error'
                      ? '1px solid rgba(239, 68, 68, 0.45)'
                      : '1px solid rgba(148, 163, 184, 0.18)',
                    backdropFilter: 'blur(12px)',
                    color: msg.sender === 'error' ? '#fca5a5' : '#e2e8f0',
                    padding: '9px 13px',
                    borderRadius: '15px 15px 15px 4px',
                    fontSize: '13.5px',
                    lineHeight: '1.55',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    boxShadow: '0 4px 16px rgba(2, 6, 23, 0.35)'
                  }}>{msg.text}</div>
                );
              })}

              {thinking && (
                <div className="mh-bot-msg" style={{
                  alignSelf: 'flex-start',
                  background: 'rgba(30, 41, 59, 0.55)',
                  border: '1px solid rgba(148, 163, 184, 0.18)',
                  padding: '10px 14px',
                  borderRadius: '15px 15px 15px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {[0, 1, 2].map((d) => (
                      <span key={d} style={{
                        width: '7px', height: '7px', borderRadius: '50%', background: '#38bdf8',
                        display: 'inline-block',
                        animation: 'mh-bot-dot 1.1s infinite ease-in-out',
                        animationDelay: `${d * 0.16}s`
                      }} />
                    ))}
                  </span>
                  <span style={{ fontSize: '11.5px', color: '#7dd3fc', fontStyle: 'italic' }}>
                    Analyzing live telemetry…
                  </span>
                </div>
              )}
            </div>

            {/* Voice status strip */}
            {(speaking || listening) && (
              <div style={{
                padding: '0 14px 4px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '700',
                  letterSpacing: '0.04em',
                  padding: '3px 12px',
                  borderRadius: '999px',
                  color: speaking ? '#67e8f9' : '#f87171',
                  background: speaking ? 'rgba(103, 232, 249, 0.12)' : 'rgba(248, 113, 113, 0.12)',
                  border: `1px solid ${speaking ? 'rgba(103, 232, 249, 0.35)' : 'rgba(248, 113, 113, 0.35)'}`
                }}>
                  {speaking ? '🔊 FEMALE VOICE SPEAKING — tap 🔊 mic to mute' : '🎙️ LISTENING… bol kar kaam karein'}
                </span>
              </div>
            )}

            {/* Quick prompts */}
            <div className="mh-bot-chips" style={{
              display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 12px 0',
              scrollbarWidth: 'none'
            }}>
              {CTA_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  onClick={() => handleQuickPrompt(opt)}
                  style={{
                    flexShrink: 0,
                    background: 'rgba(56, 189, 248, 0.09)',
                    border: '1px solid rgba(56, 189, 248, 0.28)',
                    color: '#7dd3fc',
                    borderRadius: '14px',
                    padding: '5px 11px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    backdropFilter: 'blur(8px)',
                    transition: 'background 0.2s'
                  }}
                >{opt}</button>
              ))}
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{
              display: 'flex', gap: '8px', alignItems: 'center',
              padding: '10px 12px 12px',
              background: 'transparent',
              borderTop: '1px solid rgba(148, 163, 184, 0.14)'
            }}>
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={voiceMode ? 'Stop voice mode / mute assistant' : 'Speak to Struct AI Copilot'}
                title={speaking ? 'Click to mute the assistant' : voiceMode ? 'Voice mode active — click to stop' : 'Speak your query (female-voice replies)'}
                style={{
                  width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
                  cursor: 'pointer', transition: 'all 0.2s',
                  background: speaking ? 'rgba(239, 68, 68, 0.22)' : listening ? 'rgba(34, 197, 94, 0.18)' : 'rgba(56, 189, 248, 0.1)',
                  border: speaking ? '1px solid rgba(239, 68, 68, 0.55)' : listening ? '1px solid rgba(34, 197, 94, 0.55)' : '1px solid rgba(56, 189, 248, 0.35)',
                  color: speaking ? '#f87171' : listening ? '#4ade80' : '#7dd3fc',
                  animation: speaking ? 'mh-ring-red 1.1s infinite' : listening ? 'mh-ring-green 1.1s infinite' : 'none'
                }}
              >
                {speaking ? '🔇' : listening ? '🎙️' : '🎤'}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Type in English / Hinglish…"
                style={{
                  flex: 1,
                  background: 'rgba(2, 6, 23, 0.6)',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  borderRadius: '11px',
                  padding: '10px 13px',
                  color: '#fff',
                  fontSize: '13px',
                  outline: 'none',
                  backdropFilter: 'blur(8px)',
                  minWidth: 0
                }}
              />

              <button
                type="submit"
                disabled={!inputVal.trim() || thinking}
                style={{
                  background: 'linear-gradient(90deg, #0284c7 0%, #06b6d4 100%)',
                  color: '#fff',
                  border: '1px solid rgba(125, 211, 252, 0.3)',
                  borderRadius: '11px',
                  padding: '10px 15px',
                  fontWeight: 'bold',
                  cursor: thinking ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  opacity: !inputVal.trim() ? 0.55 : 1,
                  flexShrink: 0,
                  boxShadow: '0 6px 18px rgba(6, 182, 212, 0.3)'
                }}
              >➤ Send</button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Launcher Button */}
      <button
        className="mh-bot-fab"
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open Struct AI Copilot"
        style={{
          position: 'fixed',
          bottom: '22px',
          right: '24px',
          width: '58px',
          height: '58px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(8, 145, 178, 0.85), rgba(2, 132, 199, 0.9))',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff',
          fontSize: '27px',
          cursor: 'pointer',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: listening ? 'mh-ring-green 1.1s infinite' : speaking ? 'mh-ring-red 1.1s infinite' : 'mh-fab-glow 2.6s ease-in-out infinite',
          backdropFilter: 'blur(10px)'
        }}
      >
        {isOpen ? '✕' : '🤖'}
        {!isOpen && (
          <span style={{
            position: 'absolute', top: '-2px', right: '-2px', width: '13px', height: '13px',
            borderRadius: '50%', background: listening || speaking ? '#ef4444' : '#4ade80',
            border: '2px solid #020617',
            animation: (listening || speaking) ? 'mh-ring-red 1.1s infinite' : 'none'
          }} />
        )}
      </button>
    </>
  );
};

export default AIChatbotCopilot;