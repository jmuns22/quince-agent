import { useState, useRef, useEffect } from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBoxRef = useRef(null);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;
    const next = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await res.json();
      const text = data.content?.find(b => b.type === "text")?.text
        || data.error
        || "(no reply)";
      setMessages([...next, { role: "assistant", content: text }]);
    } catch (e) {
      setMessages([...next, { role: "assistant", content: "Network error — check the server is running." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !loading) send();
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Quince Shopping Assistant</h2>
      <div ref={chatBoxRef} style={{ height: 300, overflowY: "auto", border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <p key={i}><b>{m.role}:</b> {typeof m.content === "string" ? m.content : JSON.stringify(m.content)}</p>
        ))}
        {loading && <p><i>thinking...</i></p>}
      </div>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={loading}
        style={{ width: "80%" }}
      />
      <button onClick={send} disabled={loading}>Send</button>
    </div>
  );
}

