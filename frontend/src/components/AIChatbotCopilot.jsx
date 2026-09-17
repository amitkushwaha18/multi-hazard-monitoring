import React, { useState } from 'react';

const AIChatbotCopilot = () => {
  const [messages, setMessages] = useState([
    { sender: 'ai', text: 'Hello! I am your Emergency Copilot. How can I assist you with multi-hazard safety today?' }
  ]);
  const [inputVal, setInputVal] = useState('');

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg = { sender: 'user', text: inputVal };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputVal('');

    // Simulate AI Copilot Response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        { sender: 'ai', text: 'Stay hydrated, avoid direct sun exposure between 12 PM - 4 PM, and keep emergency contact numbers handy. Let me know if you need nearest shelter locations.' }
      ]);
    }, 1000);
  };

  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '20px',
      color: '#fff',
      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
      marginTop: '20px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: '8px' }}>
          💬 AI Chatbot / Emergency Copilot
        </h2>
        <span style={{ fontSize: '12px', background: '#0e7490', color: '#ecfeff', padding: '4px 10px', borderRadius: '12px', fontWeight: 'bold' }}>
          Live Support Active
        </span>
      </div>

      <div style={{ background: '#020617', padding: '16px', borderRadius: '12px', border: '1px solid #1e293b', height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        
        {/* Chat Messages Container */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px', maxHeight: '110px' }}>
          {messages.map((msg, index) => (
            <div key={index} style={{
              alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
              background: msg.sender === 'user' ? '#2563eb' : '#1e293b',
              color: '#fff',
              padding: '8px 12px',
              borderRadius: '8px',
              fontSize: '13px',
              maxWidth: '80%'
            }}>
              {msg.text}
            </div>
          ))}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
          <input 
            type="text" 
            placeholder="Ask emergency protocol..." 
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            style={{
              flex: 1,
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '8px 12px',
              color: '#fff',
              fontSize: '13px'
            }}
          />
          <button 
            type="submit"
            style={{
              background: '#06b6d4',
              color: '#020617',
              border: 'none',
              borderRadius: '6px',
              padding: '8px 14px',
              fontWeight: 'bold',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default AIChatbotCopilot;