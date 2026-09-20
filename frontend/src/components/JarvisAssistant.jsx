import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const STRUCT_COPILOT_SYSTEM_PROMPT = (contextData) => `
YOU ARE STRUCT AI COPILOT, A REAL-TIME MULTI-HAZARD DISASTER AND STRUCTURAL HEALTH ASSISTANT EMBEDDED IN THIS DASHBOARD.
YOU HAVE ACCESS TO LIVE REAL-TIME SENSOR AND HAZARD TELEMETRY DATA BELOW:

LIVE SYSTEM CONTEXT:
${JSON.stringify(contextData || {}, null, 2)}

STRICT LANGUAGE & IDENTITY RULES:
- Your name is STRUCT AI COPILOT.
- Speak ONLY in English or Hinglish (Hindi written in Roman/English script, e.g., "Main aapko live data ke basis par bata raha hu").
- NEVER use Devanagari script (DO NOT write in "हिंदी" script like "जानकारी नहीं दे सकता").
- Keep the tone casual, respectful, professional, and friendly.

EXECUTION INSTRUCTIONS:
- Always analyze the LIVE SYSTEM CONTEXT above to answer queries regarding flood levels, wind speeds, cyclone alerts, earthquake updates, or structural asset health.
- NEVER say "I don't have access to real-time data". You DO have live access via contextData.
- Provide clear risk predictions and immediate safety steps based on live telemetry numbers.
`;

const HAZARD_MODALS = {
  flood: ['flood', 'badh', 'barish', 'water logging', 'waterlogging'],
  earthquake: ['earthquake', 'seismic', 'seism', 'bhukamp', 'quake'],
  cyclone: ['cyclone', 'wind storm', 'wind speed', 'wind', 'typhoon', 'hurricane', 'toofan', 'toofaan']
};

const parseDashCommand = (text) => {
  const t = text.toLowerCase().trim();
  if (!t) return null;

  const findHazard = () => {
    for (const [hazard, kws] of Object.entries(HAZARD_MODALS)) {
      if (kws.some(kw => t.includes(kw))) return hazard;
    }
    return null;
  };

  // 1) Open modal / detail / panel / dashboard commands
  const modalHint = /\b(open|show|display|launch|bring up|open the)\b.*\b(modal|detail|details|analysis|dashboard|panel)\b/;
  const hazard = findHazard();
  if (hazard && modalHint.test(t)) {
    return { type: 'OPEN_MODAL', modal: hazard };
  }

  const standardWay = (prep) => `.{0,20}?\\b(${prep})\\s+([a-zA-Z][\\sA-Za-z.'-,]{1,40})(?:[?!.,;]*)$`;
  const trailingCity = t.match(
    new RegExp(`\\b(risk|hazard|activity|analysis|level|situation|khatra|khatre)\\b${standardWay('in|at|for|of|near|me|mein|ke liye')}`)
  );
  if (trailingCity && (hazard !== null || /\b(risk|hazard|khatra|khatre)\b/.test(t))) {
    return { type: 'ANALYZE_RISK', city: trailingCity[3].replace(/[?!.,;]+$/g, '').trim(), hazard };
  }

  const verbCity = t.match(
    new RegExp(`\\b(analy[sz]e|check|assess)\\b.{0,15}?\\b(?:risk\\s+)?${standardWay('in|at|for|of|near|me|mein|ke liye')}`)
  );
  if (verbCity) {
    return { type: 'ANALYZE_RISK', city: verbCity[3].replace(/[?!.,;]+$/g, '').trim(), hazard };
  }

  const cityFirst = t.match(/([a-zA-Z][\sA-Za-z.'-]{1,40}?)\s+(?:me|mein|ke liye)\s+.{0,20}?\b(?:risk|khatra|hazard)\b/);
  if (cityFirst) {
    return { type: 'ANALYZE_RISK', city: cityFirst[1].replace(/[?!.,;]+$/g, '').trim(), hazard };
  }

  // 4) Factual metric query with a known hazard keyword: e.g. "what is the wind speed in Ahmedabad"
  const metricCity = t.match(
    new RegExp(`\\b(what is|what's|whats|how is|tell me|current|today)\\b.{0,25}?${standardWay('in|at|for|of|near|me|mein|ke liye')}`)
  );
  if (metricCity && hazard !== null) {
    return { type: 'ANALYZE_RISK', city: metricCity[3].replace(/[?!.,;]+$/g, '').trim(), hazard };
  }

  // 5) Fallback: hazard keyword + "risk" (no city) -> ask for a city
  if (hazard && /\brisk\b/.test(t)) {
    return { type: 'ANALYZE_RISK', city: null, hazard };
  }

  return null;
};

const buildContextData = ({ selectedLocation, seismicEvents, assets }) => {
  const risk = selectedLocation?.risk || null;
  const telemetry = selectedLocation?.telemetry || null;
  const eqEvents = Array.isArray(seismicEvents) ? seismicEvents : [];
  const evToContext = (ev) => ({
    magnitude: ev?.properties?.mag,
    place: ev?.properties?.place,
    time: ev?.properties?.time ? new Date(ev.properties.time).toISOString() : null
  });
  const maxMagnitude = eqEvents.reduce((m, ev) => Math.max(m, ev?.properties?.mag || 0), 0);
  const assetList = Array.isArray(assets) ? assets : [];
  return {
    location: selectedLocation
      ? { city: selectedLocation.cityName, lat: selectedLocation.lat, lng: selectedLocation.lng }
      : null,
    flood: {
      risk: risk?.floodRisk || null,
      precipitationMm: risk?.precipitationMm ?? null,
      currentPrecipitation: telemetry?.currentPrecipitation ?? null,
      currentTemperature: telemetry?.currentTemperature ?? null,
      currentSoilMoisture: telemetry?.currentSoilMoisture ?? null,
      peakHourlyPrecipitation: telemetry?.peakHourlyPrecipitation ?? null
    },
    cyclone: {
      risk: risk?.cycloneRisk || null,
      windSpeedKmh: risk?.windSpeedKmh ?? null
    },
    earthquake: {
      risk: risk?.seismicRisk || null,
      magnitude: risk?.magnitude ?? maxMagnitude,
      recentEvents: eqEvents.slice(0, 5).map(evToContext)
    },
    assets: assetList.map((a) => ({
      name: a?.name,
      type: a?.type,
      status: a?.status,
      city: a?.location?.city,
      structuralHealthIndex: a?.healthMetrics?.structuralHealthIndex ?? null,
      vibration: a?.healthMetrics?.vibration ?? null,
      tilt: a?.healthMetrics?.tilt ?? null,
      crackWidth: a?.healthMetrics?.crackWidth ?? null
    }))
  };
};

const JarvisAssistant = ({ onDashCommand, voiceResult, selectedLocation, seismicEvents, assets }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { sender: 'jarvis', text: 'Namaste! 🙏 Main Struct AI Copilot hoon, aapka real-time multi-hazard disaster aur structural health assistant. Flood, cyclone, earthquake aur asset sensor data ke live telemetry ke basis par turant guidance de sakta hoon. English ya Hinglish mein poochhiye!' }
  ]);
  const [isListening, setIsListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);

  const chatEndRef = useRef(null);
  const voicesRef = useRef([]);
  const recognitionRef = useRef(null);
  const restartTimeoutRef = useRef(null);
  const dashTimeoutRef = useRef(null);
  const lastLangRef = useRef('hi-IN');
  const voiceModeRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const loadingRef = useRef(false);
  const historyRef = useRef([]);
  const pendingSpeakRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const loadVoices = () => { voicesRef.current = window.speechSynthesis.getVoices(); };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => { clearTimeout(restartTimeoutRef.current); };
  }, []);

  const setLoadingBoth = (val) => { loadingRef.current = val; setLoading(val); };
  const setSpeakingBoth = (val) => { isSpeakingRef.current = val; setIsSpeaking(val); };
  const setVoiceModeBoth = (val) => { voiceModeRef.current = val; setVoiceMode(val); };

  const detectLang = (text) => {
    if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
    if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh-CN';
    if (/[\u3040-\u30ff]/.test(text)) return 'ja-JP';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko-KR';
    const lower = text.toLowerCase();
    const hinglishWords = ['mera', 'naam', 'kya', 'kaise', 'mausam', 'aaj', 'hawa', 'bhukamp', 'badh', 'hai', 'kaha', 'batao', 'bta', 'tum', 'aap', 'thik', 'hello', 'kaisi'];
    if (hinglishWords.some(w => lower.split(/\s+/).includes(w))) return 'hi-IN';
    return 'en-US';
  };

  const pickVoice = (lang) => {
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const base = lang.split('-')[0];
    const exactHQ = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase() && /natural|online|neural|google/i.test(v.name));
    if (exactHQ) return exactHQ;
    const exact = voices.find(v => v.lang.toLowerCase() === lang.toLowerCase());
    if (exact) return exact;
    const sameBase = voices.find(v => v.lang.toLowerCase().startsWith(base));
    if (sameBase) return sameBase;
    const enHQ = voices.find(v => v.lang.toLowerCase().startsWith('en') && /natural|online|neural|google/i.test(v.name));
    return enHQ || voices.find(v => v.lang.toLowerCase().startsWith('en')) || voices[0];
  };

  const speakText = (text, lang = 'en-US') => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    const voice = pickVoice(lang);
    if (voice) utterance.voice = voice;

    utterance.onstart = () => setSpeakingBoth(true);
    utterance.onend = () => {
      setSpeakingBoth(false);
      maybeResumeListening();
    };
    utterance.onerror = () => {
      setSpeakingBoth(false);
      maybeResumeListening();
    };

    window.speechSynthesis.speak(utterance);
  };

  const interruptSpeaking = () => {
    window.speechSynthesis.cancel();
    setSpeakingBoth(false);
    maybeResumeListening();
  };

  const maybeResumeListening = () => {
    if (!voiceModeRef.current) return;
    if (isSpeakingRef.current || loadingRef.current) return;
    clearTimeout(restartTimeoutRef.current);
    restartTimeoutRef.current = setTimeout(() => {
      if (voiceModeRef.current && !isSpeakingRef.current && !loadingRef.current) startListening();
    }, 600);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      setVoiceModeBoth(false);
      return;
    }
    if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }

    const recognition = new SpeechRecognition();
    recognition.lang = lastLangRef.current;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onerror = () => { setIsListening(false); maybeResumeListening(); };
    recognition.onend = () => { setIsListening(false); maybeResumeListening(); };

    recognition.onresult = (event) => {
      // Mirrors the standalone Jarvis mic gate: while Struct AI Copilot is speaking the
      // mic feed is ignored so it never triggers on its own TTS audio.
      if (isSpeakingRef.current || loadingRef.current) return;
      const speechText = event.results[0][0].transcript;
      setInput(speechText);
      handleUserQuery(speechText, true);
    };

    recognitionRef.current = recognition;
    try { recognition.start(); } catch (e) {}
  };

  const toggleVoiceMode = () => {
    if (voiceMode) {
      setVoiceModeBoth(false);
      clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) { try { recognitionRef.current.stop(); } catch (e) {} }
      window.speechSynthesis.cancel();
      setSpeakingBoth(false);
      setIsListening(false);
    } else {
      setVoiceModeBoth(true);
      startListening();
    }
  };

  const minDelay = (promise, ms = 1200) =>
    Promise.all([promise, new Promise(r => setTimeout(r, ms))]).then(([res]) => res);

  const toText = (value) => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value && value.target && typeof value.target.value === 'string') return value.target.value.trim();
    return String(value || '').trim();
  };

  // Bypassing proxy completely by using direct absolute URL to port 5000.
  // Mirrors the standalone Jarvis execution: Struct AI Copilot system instruction +
  // multi-turn history + live telemetry contextData + the latest user message
  // are passed to the backend, which makes the Groq call.
  const callAI = async (queryText, lang) => {
    const safeText = toText(queryText);
    if (!safeText) return null;
    const history = historyRef.current.slice(-8);
    const contextData = buildContextData({ selectedLocation, seismicEvents, assets });
    const systemPrompt = STRUCT_COPILOT_SYSTEM_PROMPT(contextData);
    const endpoints = [
      `${API_BASE_URL}/api/jarvis-chat`,
      `${API_BASE_URL}/api/chat`
    ];
    for (const url of endpoints) {
      try {
        const res = await axios.post(url, {
          message: safeText,
          lang,
          history,
          systemPrompt,
          contextData
        }, { timeout: 30000 });
        if (res?.data?.reply) return res.data.reply;
      } catch (err) {
        console.warn(`AI endpoint unavailable (${url}):`, err.message);
      }
    }
    return null;
  };

  const buildRiskSpeech = (result, lang, hazard, city) => {
    const risk = result?.risk || {};
    const cityName = result?.cityName || city || 'the location';
    const clean = (s) => String(s || '0').replace(/\s*\(\d+%\)\s*$/, '');
    const flood = clean(risk.floodRisk);
    const seismic = clean(risk.seismicRisk);
    const wind = clean(risk.cycloneRisk);

    if (lang === 'hi-IN') {
      const h = hazard === 'earthquake' ? 'bhukamp' : hazard === 'cyclone' ? 'toofan' : 'badh';
      return `${cityName} mein abhi ${h} risk: ${flood}. Seismic risk: ${seismic}. Wind: ${risk.windSpeedKmh ?? 0} km/h.`;
    }
    if (hazard === 'earthquake') {
      return `Current seismic risk in ${cityName}: ${seismic}.`;
    }
    if (hazard === 'cyclone') {
      return `Current wind and cyclone risk in ${cityName}: ${wind}, at ${risk.windSpeedKmh ?? 0} kilometers per hour.`;
    }
    return `Current flood risk in ${cityName}: ${flood}, at ${risk.precipitationMm ?? 0} millimeters precipitation. Seismic risk: ${seismic}. Wind risk: ${wind}.`;
  };

  useEffect(() => {
    const pending = pendingSpeakRef.current;
    if (!pending) return;
    if (!voiceResult || voiceResult.seq !== pending.seq) return;

    pendingSpeakRef.current = null;
    clearTimeout(dashTimeoutRef.current);
    setLoadingBoth(false);

    const speech = buildRiskSpeech(voiceResult.result, pending.lang, pending.hazard, pending.city);
    setMessages(prev => [...prev, { sender: 'jarvis', text: speech }]);
    historyRef.current.push({ role: 'assistant', content: speech });

    if (pending.speak) {
      speakText(speech, pending.lang);
    }
  }, [voiceResult]);

  const handleUserQuery = async (queryText, spokeByVoice = false) => {
    const textValue = toText(queryText);
    if (!textValue) return;

    setMessages(prev => [...prev, { sender: 'user', text: textValue }]);
    setInput('');
    setLoadingBoth(true);

    const lang = detectLang(textValue);
    lastLangRef.current = lang;
    const isHindi = lang === 'hi-IN';

    historyRef.current.push({ role: 'user', content: textValue });

    const dashCmd = parseDashCommand(textValue);
    if (dashCmd) {
      const speak = spokeByVoice || voiceModeRef.current;

      if (dashCmd.type === 'ANALYZE_RISK' && dashCmd.city) {
          const seq = Date.now();
          pendingSpeakRef.current = { seq, lang, hazard: dashCmd.hazard, city: dashCmd.city, speak };
          if (typeof onDashCommand === 'function') {
            onDashCommand({ type: 'ANALYZE_RISK', city: dashCmd.city, hazard: dashCmd.hazard, seq });
          }
          clearTimeout(dashTimeoutRef.current);
          dashTimeoutRef.current = setTimeout(() => {
            if (pendingSpeakRef.current && pendingSpeakRef.current.seq === seq) {
              pendingSpeakRef.current = null;
              setLoadingBoth(false);
              const fallback = isHindi
                ? `Main ${dashCmd.city} ke liye data fetch nahi kar saki. Kripya backend server check karein.`
                : `I could not fetch hazard data for ${dashCmd.city}. Please check the backend server connection.`;
              setMessages(prev => [...prev, { sender: 'jarvis', text: fallback }]);
              if (speak) speakText(fallback, lang);
            }
          }, 25000);
      } else if (dashCmd.type === 'OPEN_MODAL' && dashCmd.modal) {
        pendingSpeakRef.current = null;
        clearTimeout(dashTimeoutRef.current);
        setLoadingBoth(false);
        if (typeof onDashCommand === 'function') {
          onDashCommand({ type: 'OPEN_MODAL', modal: dashCmd.modal });
        }
        const ack = isHindi
          ? `Ji, ${dashCmd.modal} ka detail analysis modal khol rahi hoon.`
          : `Opening the ${dashCmd.modal} hazard detail modal now.`;
        setMessages(prev => [...prev, { sender: 'jarvis', text: ack }]);
        historyRef.current.push({ role: 'assistant', content: ack });
        if (speak) speakText(ack, lang);
      } else {
        clearTimeout(dashTimeoutRef.current);
        pendingSpeakRef.current = null;
        setLoadingBoth(false);
        const hint = isHindi
          ? "Kripya city ke saath risk poochhein, jaise 'Lucknow mein flood risk kya hai'."
          : 'Please mention a city with the risk, e.g. "what is the flood risk in Lucknow?".';
        setMessages(prev => [...prev, { sender: 'jarvis', text: hint }]);
        historyRef.current.push({ role: 'assistant', content: hint });
        if (speak) speakText(hint, lang);
      }
      return;
    }

    let responseText = await minDelay(callAI(textValue, lang), 1400);

    if (!responseText) {
      responseText = isHindi 
        ? "Main Struct AI Copilot abhi server se connect nahi ho pa rahi hoon, kripya check karein ki backend server chalu hai ya nahi." 
        : "I am unable to connect to the AI server right now. Please ensure the backend server is running.";
    }

    historyRef.current.push({ role: 'assistant', content: responseText });

    setLoadingBoth(false);
    setMessages(prev => [...prev, { sender: 'jarvis', text: responseText }]);

    if (spokeByVoice || voiceModeRef.current) {
      speakText(responseText, lang);
    }
  };

  return (
    <div className="jarvis-root" style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 99999, fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes jarvisGlow {
          0% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0.6); }
          70% { box-shadow: 0 0 0 18px rgba(236, 72, 153, 0); }
          100% { box-shadow: 0 0 0 0 rgba(236, 72, 153, 0); }
        }
        .jarvis-female-orb { animation: jarvisGlow 2.2s infinite; }
        .jarvis-scrollbar::-webkit-scrollbar { width: 5px; }
        .jarvis-scrollbar::-webkit-scrollbar-thumb { background: #ec489955; border-radius: 10px; }
      `}</style>

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="jarvis-female-orb"
          style={{
            background: 'radial-gradient(circle, #db2777 0%, #030712 90%)',
            border: '2px solid #f472b6', borderRadius: '50%', width: '64px', height: '64px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '28px', color: '#fff', boxShadow: '0 8px 30px rgba(219,39,119,0.5)'
          }}
          title="Open Struct AI Copilot"
        >
          👩‍💻
        </button>
      )}

      {isOpen && (
        <div className="jarvis-window" style={{
          width: '390px', height: '540px', background: 'rgba(3, 7, 18, 0.96)',
          border: '1px solid #f472b688', borderRadius: '20px', display: 'flex', flexDirection: 'column',
          boxShadow: '0 25px 60px rgba(0,0,0,0.9), 0 0 35px rgba(244, 114, 182, 0.25)',
          backdropFilter: 'blur(16px)', overflow: 'hidden'
        }}>
          <div style={{
            background: 'linear-gradient(90deg, #0f172a 0%, #db2777 100%)', padding: '16px 20px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>💖</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', color: '#fff', fontWeight: 'bold' }}>STRUCT AI COPILOT</h3>
                <span style={{ fontSize: '10px', color: '#f472b6', letterSpacing: '1px' }}>
                  {isSpeaking ? '🔊 SPEAKING...' : voiceMode ? '🎙️ LIVE VOICE MODE ACTIVE' : '● AUTO-LANG & CHAT ACTIVE'}
                </span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: '#cbd5e1', fontSize: '18px', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
          </div>

          <div className="jarvis-scrollbar" style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg, idx) => (
              <div key={idx} style={{
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                background: msg.sender === 'user' ? '#db2777' : 'rgba(15, 23, 42, 0.95)',
                color: '#fff', padding: '10px 14px', borderRadius: '12px', maxWidth: '82%',
                fontSize: '13.5px', lineHeight: 1.5,
                border: msg.sender === 'jarvis' ? '1px solid #334155' : 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}>
                {msg.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: 'flex-start', color: '#f472b6', fontSize: '12px', fontStyle: 'italic', padding: '6px' }}>
                🔍 Struct AI Copilot analyzing live telemetry & searching...
              </div>
            )}
            {isListening && (
              <div style={{ alignSelf: 'flex-end', color: '#f472b6', fontSize: '12px', fontStyle: 'italic', padding: '6px' }}>
                🎙️ Sun rahi hoon, boliye...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {isSpeaking && (
            <div style={{ padding: '6px 14px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={interruptSpeaking} style={{
                background: '#1e293b', color: '#f87171', border: '1px solid #ef4444', borderRadius: '20px',
                padding: '6px 14px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'
              }}>
                ⏹ Stop Speaking
              </button>
            </div>
          )}

          <div style={{ padding: '14px', borderTop: '1px solid #1e293b', background: '#020617', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={toggleVoiceMode}
              style={{
                background: voiceMode ? '#ef4444' : '#1e293b',
                color: voiceMode ? '#fff' : '#f472b6',
                border: '1px solid #334155', borderRadius: '50%', width: '40px', height: '40px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px'
              }}
              title={voiceMode ? 'Click to stop live voice mode' : 'Click to start continuous live voice'}
            >
              🎙️
            </button>

            <input
              type="text"
              placeholder="Ask anything (auto detects language)..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUserQuery(input, false)}
              style={{
                flex: 1, background: '#030712', border: '1px solid #334155', borderRadius: '8px',
                padding: '10px 12px', color: '#fff', outline: 'none', fontSize: '13px'
              }}
            />

            <button
              onClick={() => handleUserQuery(input, false)}
              style={{
                background: '#db2777', color: '#fff', border: 'none', borderRadius: '8px',
                padding: '10px 14px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px'
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JarvisAssistant;