import React, { useState, useEffect, useRef } from 'react';
import { sendChatMessage } from '../services/api';

export default function ChatbotWidget({ theme = 'light', onSelectProject }) {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: '👋 **Hello! I am the VeriFund AI Copilot.**\n\nHow can I help you today? You can ask about active campaigns, MetaMask Web3 testing, AI fraud risk scoring, or milestone impact verification.',
      suggestedActions: [
        '💧 Show active campaigns',
        '💡 How to donate via MetaMask',
        '🛡️ Explain AI Fraud Risk',
        '📈 What is AI Impact Analysis?'
      ],
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend) => {
    const text = (textToSend || input).trim();
    if (!text || loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newMessages = [
      ...messages,
      { sender: 'user', text, time: userTime }
    ];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages.map(m => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text }));
      const res = await sendChatMessage(text, history);

      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      if (res.ok && res.data.success) {
        setMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: res.data.reply,
            suggestedActions: res.data.suggestedActions || [],
            time: botTime
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            sender: 'bot',
            text: '⚠️ Sorry, I encountered an issue retrieving platform details. Please try again.',
            suggestedActions: ['💧 Show active campaigns', '💡 How to donate via MetaMask'],
            time: botTime
          }
        ]);
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: '⚠️ Network error communicating with the AI service.',
          suggestedActions: ['💧 Show active campaigns'],
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const renderFormattedText = (rawText) => {
    return rawText.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4
            key={idx}
            style={{
              margin: '10px 0 4px 0',
              color: isDark ? '#93C5FD' : '#1E3A8A',
              fontSize: '1rem',
              fontWeight: '700'
            }}
          >
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('• ') || line.startsWith('- ')) {
        const itemContent = line.replace(/^[•\-]\s*/, '');
        return (
          <div key={idx} style={{ display: 'flex', gap: '8px', margin: '4px 0' }}>
            <span style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>•</span>
            <div>{renderInlineMarkdown(itemContent)}</div>
          </div>
        );
      }
      if (line.trim() === '') {
        return <div key={idx} style={{ height: '6px' }} />;
      }
      return <div key={idx} style={{ margin: '3px 0' }}>{renderInlineMarkdown(line)}</div>;
    });
  };

  const renderInlineMarkdown = (str) => {
    const parts = [];
    let remaining = str;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      const codeMatch = remaining.match(/`(.*?)`/);

      let firstMatch = null;
      let matchType = null;

      if (boldMatch && (!codeMatch || boldMatch.index < codeMatch.index)) {
        firstMatch = boldMatch;
        matchType = 'bold';
      } else if (codeMatch) {
        firstMatch = codeMatch;
        matchType = 'code';
      }

      if (firstMatch) {
        if (firstMatch.index > 0) {
          parts.push(<span key={key++}>{remaining.substring(0, firstMatch.index)}</span>);
        }
        if (matchType === 'bold') {
          parts.push(
            <strong
              key={key++}
              style={{ color: isDark ? '#FFFFFF' : '#0B1F3A', fontWeight: '700' }}
            >
              {firstMatch[1]}
            </strong>
          );
        } else {
          parts.push(
            <code
              key={key++}
              style={{
                background: isDark ? '#1E3A8A' : '#E0E7FF',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '0.86em',
                color: isDark ? '#BFDBFE' : '#3730A3',
                fontFamily: 'JetBrains Mono, monospace'
              }}
            >
              {firstMatch[1]}
            </code>
          );
        }
        remaining = remaining.substring(firstMatch.index + firstMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }
    return parts;
  };

  return (
    <aside style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, fontFamily: "'Plus Jakarta Sans', sans-serif" }} aria-label="AI Chatbot Assistant">
      {/* Expanded Chat Window */}
      {isOpen && (
        <section
          style={{
            width: '400px',
            maxWidth: 'calc(100vw - 32px)',
            height: '560px',
            maxHeight: 'calc(100vh - 100px)',
            background: isDark ? '#0F1D38' : '#FFFFFF',
            borderRadius: '16px',
            boxShadow: isDark
              ? '0 20px 48px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(79, 134, 255, 0.25)'
              : '0 20px 48px rgba(11, 31, 58, 0.2), 0 0 0 1px rgba(36, 87, 214, 0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: isDark ? '1px solid #1E3560' : '1px solid #DCE5F2',
            marginBottom: '14px',
            animation: 'fadeIn 0.22s ease-out'
          }}
          aria-labelledby="chat-heading"
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              background: isDark
                ? 'linear-gradient(135deg, #0A1428 0%, #162E63 100%)'
                : 'linear-gradient(135deg, #102A56 0%, #2457D6 100%)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #4F86FF 0%, #6366F1 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  boxShadow: '0 4px 10px rgba(79, 134, 255, 0.35)'
                }}
              >
                🤖
              </div>
              <div>
                <h3 id="chat-heading" style={{ margin: 0, fontSize: '0.98rem', fontWeight: '700', letterSpacing: '-0.01em' }}>VeriFund AI Copilot</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', opacity: 0.9 }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#2FD4A3', display: 'inline-block', boxShadow: '0 0 6px #2FD4A3' }}></span>
                  <span>Online • Web3 & AI Audit Engine</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.18)',
                color: '#FFFFFF',
                fontSize: '14px',
                cursor: 'pointer',
                padding: '6px 10px',
                borderRadius: '8px',
                transition: 'all 0.15s ease'
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
              onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
              aria-label="Close Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px',
              background: isDark ? '#080F1F' : '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '88%',
                    padding: '12px 16px',
                    borderRadius: msg.sender === 'user' ? '16px 16px 3px 16px' : '16px 16px 16px 3px',
                    background: msg.sender === 'user'
                      ? 'linear-gradient(135deg, #2457D6 0%, #1A44B0 100%)'
                      : (isDark ? '#142548' : '#FFFFFF'),
                    color: msg.sender === 'user' ? '#FFFFFF' : (isDark ? '#EEF4FF' : '#0B1F3A'),
                    fontSize: '0.92rem',
                    lineHeight: '1.5',
                    boxShadow: msg.sender === 'user' ? '0 4px 12px rgba(36, 87, 214, 0.3)' : (isDark ? '0 2px 6px rgba(0,0,0,0.3)' : '0 2px 6px rgba(11,31,58,0.06)'),
                    border: msg.sender === 'user' ? 'none' : (isDark ? '1px solid #1E3560' : '1px solid #DCE5F2'),
                    wordBreak: 'break-word'
                  }}
                >
                  {renderFormattedText(msg.text)}
                </div>

                <span style={{ fontSize: '0.72rem', color: isDark ? '#6B82A6' : '#7E92AB', marginTop: '4px', padding: '0 4px' }}>
                  {msg.time}
                </span>

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 && idx === messages.length - 1 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {msg.suggestedActions.map((action, aIdx) => (
                      <button
                        key={aIdx}
                        onClick={() => handleSend(action)}
                        style={{
                          background: isDark ? '#101D38' : '#EEF4FD',
                          color: isDark ? '#93C5FD' : '#2457D6',
                          border: isDark ? '1px solid #243D6E' : '1px solid #BACFF8',
                          borderRadius: '16px',
                          padding: '5px 12px',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: '600',
                          transition: 'all 0.18s ease'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = isDark ? '#1E3560' : '#DBEAFE';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = isDark ? '#101D38' : '#EEF4FD';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px 16px',
                  background: isDark ? '#142548' : '#FFFFFF',
                  color: isDark ? '#A0B5D3' : '#475D7A',
                  borderRadius: '14px',
                  width: 'fit-content',
                  border: isDark ? '1px solid #1E3560' : '1px solid #DCE5F2',
                  boxShadow: 'var(--shadow-xs)'
                }}
              >
                <span style={{ fontSize: '15px' }}>🤖</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>AI is checking live platform telemetry...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '14px 16px',
              background: isDark ? '#0F1D38' : '#FFFFFF',
              borderTop: isDark ? '1px solid #1E3560' : '1px solid #DCE5F2',
              display: 'flex',
              gap: '10px',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about campaigns, MetaMask, AI audit..."
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '24px',
                background: isDark ? '#080F1F' : '#F4F7FC',
                color: isDark ? '#EEF4FF' : '#0B1F3A',
                border: isDark ? '1px solid #243D6E' : '1px solid #CBD8EB',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'all 0.18s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = isDark ? '#4F86FF' : '#2457D6';
                e.target.style.boxShadow = '0 0 0 3px rgba(36, 87, 214, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = isDark ? '#243D6E' : '#CBD8EB';
                e.target.style.boxShadow = 'none';
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: input.trim()
                  ? 'linear-gradient(135deg, #2457D6 0%, #1A44B0 100%)'
                  : (isDark ? '#1E3560' : '#CBD8EB'),
                color: '#FFFFFF',
                border: 'none',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                transition: 'all 0.18s ease',
                boxShadow: input.trim() ? '0 4px 12px rgba(36, 87, 214, 0.35)' : 'none'
              }}
              aria-label="Send Message"
            >
              ➤
            </button>
          </form>
        </section>
      )}

      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            padding: '13px 22px',
            borderRadius: '28px',
            background: isDark
              ? 'linear-gradient(135deg, #102A56 0%, #2457D6 100%)'
              : 'linear-gradient(135deg, #102A56 0%, #2457D6 100%)',
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: isDark
              ? '0 8px 24px rgba(79, 134, 255, 0.45), 0 0 0 1px rgba(79, 134, 255, 0.2)'
              : '0 8px 24px rgba(36, 87, 214, 0.45), 0 0 0 1px rgba(36, 87, 214, 0.2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem',
            fontWeight: '700',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(36, 87, 214, 0.6)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = isDark
              ? '0 8px 24px rgba(79, 134, 255, 0.45)'
              : '0 8px 24px rgba(36, 87, 214, 0.45)';
          }}
          aria-label="Open AI Assistant"
        >
          <span style={{ fontSize: '20px' }}>💬</span>
          <span>Ask VeriFund AI</span>
        </button>
      )}
    </aside>
  );
}

