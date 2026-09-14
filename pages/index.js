import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const QUINCE = {
  bg: "#FFFFFF",
  text: "#1A1A1A",
  topbar: "#1A1A1A",
  accent: "#F0A878",
  accentDark: "#4A2B18",
  border: "#E5E5E5",
  panelBg: "#FAFAF9"
};

const SUGGESTIONS = [
  { label: "Cashmere sweater under $100", query: "I'm looking for a cashmere sweater under $100" },
  { label: "What's your return policy?", query: "What's your return policy?" },
  { label: "Track or return my order", query: "I need to track or return my order" },
  { label: "Suggest a gift idea", query: "Can you suggest a good gift idea?" }
];

function ChatIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={QUINCE.accentDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.9-.9L3 21l1.9-5.6A8.4 8.4 0 0 1 4 12.5 8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={QUINCE.accentDark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
    </svg>
  );
}

function Bubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", margin: "6px 0" }}>
      <div
        style={{
          maxWidth: "82%",
          padding: "10px 14px",
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.5,
          background: isUser ? QUINCE.accent : QUINCE.panelBg,
          color: isUser ? QUINCE.accentDark : QUINCE.text,
          border: isUser ? "none" : `1px solid ${QUINCE.border}`
        }}
      >
        {isUser ? (
          content
        ) : (
          <div className="md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi, I can help you find something or answer a question about your order. What are you looking for?" }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, open]);

  async function sendText(text) {
    if (!text.trim() || sending) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessages([...next, { role: "assistant", content: data.error || "Something went wrong. Please try again." }]);
        return;
      }

      let text = data.content?.find(b => b.type === "text")?.text || "I don't have an answer for that. Want me to connect you with support?";
      if (data.truncated) text += "\n\n(response was cut short, ask me to continue if needed)";
      setMessages([...next, { role: "assistant", content: text }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong reaching the assistant. Please try again." }]);
    } finally {
      setSending(false);
    }
  }

  function send() {
    sendText(input);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div style={{ fontFamily: "-apple-system, 'Helvetica Neue', Arial, sans-serif", minHeight: "100vh" }}>
      {/* Placeholder host page, standing in for a Quince page during the demo */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundImage: "url(/quince-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(40px)",
          transform: "scale(1.05)",
          zIndex: -1
        }}
      />
      <div style={{ background: QUINCE.topbar, color: "#fff", textAlign: "center", padding: "6px 0", fontSize: 12, letterSpacing: 0.3 }}>
        Free shipping &amp; easy returns for 365 days.
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 32px", borderBottom: `1px solid ${QUINCE.border}` }}>
        <span style={{ fontFamily: "Georgia, serif", fontSize: 24 }}>Quince</span>
        <div style={{ fontSize: 14, color: QUINCE.text, opacity: 0.7 }}>Sign In | Wishlist | Bag</div>
      </div>
      <div style={{ padding: "80px 32px", color: QUINCE.text, opacity: 0.5, fontSize: 14 }}>
        Product page content goes here.
      </div>

      {/* Launcher bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open shopping assistant"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: QUINCE.accent,
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)"
          }}
        >
          <ChatIcon />
        </button>
      )}

      {/* Slide-in panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          height: "100vh",
          width: 380,
          maxWidth: "100vw",
          background: QUINCE.bg,
          borderLeft: `1px solid ${QUINCE.border}`,
          boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 220ms ease-out",
          zIndex: 50
        }}
      >
        <div style={{ background: QUINCE.topbar, color: "#fff", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 15, fontWeight: 500 }}>Quince Assistant</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex" }}
          >
            <CloseIcon />
          </button>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px" }}>
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} content={m.content} />
          ))}
          {messages.length === 1 && !sending && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 6px 8px" }}>
              {SUGGESTIONS.map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendText(s.query)}
                  style={{
                    fontSize: 13,
                    padding: "8px 12px",
                    borderRadius: 16,
                    border: `1px solid ${QUINCE.border}`,
                    background: QUINCE.panelBg,
                    color: QUINCE.accentDark,
                    cursor: "pointer"
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          {sending && (
            <div style={{ fontSize: 13, color: "#8a8a8a", padding: "4px 6px" }}>Thinking...</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${QUINCE.border}` }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about a product or an order..."
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${QUINCE.border}`,
              fontSize: 14,
              outline: "none"
            }}
          />
          <button
            onClick={send}
            disabled={sending}
            aria-label="Send"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: QUINCE.accent,
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: sending ? "default" : "pointer",
              opacity: sending ? 0.6 : 1
            }}
          >
            <SendIcon />
          </button>
        </div>
        <div style={{ textAlign: "center", fontSize: 11, color: "#9a9a9a", padding: "6px 0 10px" }}>
          Powered by Kinect
        </div>
      </div>

      <style jsx global>{`
        .md p { margin: 0 0 8px; }
        .md p:last-child { margin-bottom: 0; }
        .md ul, .md ol { margin: 0 0 8px 18px; padding: 0; }
        .md a { color: #B5563C; text-decoration: underline; }
        .md table { border-collapse: collapse; width: 100%; font-size: 13px; margin: 6px 0; table-layout: fixed; }
        .md th, .md td { border: 1px solid ${QUINCE.border}; padding: 6px 8px; text-align: left; word-break: break-word; }
        .md th { background: #F0EEE9; font-weight: 500; }
      `}</style>
    </div>
  );
}
