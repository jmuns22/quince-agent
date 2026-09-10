import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  async function send() {
    const next = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next })
    });
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text || "(no reply)";
    setMessages([...next, { role: "assistant", content: text }]);
  }

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h2>Quince Shopping Assistant</h2>
      <div style={{ minHeight: 300, border: "1px solid #ddd", padding: 12, marginBottom: 12 }}>
        {messages.map((m, i) => (
          <p key={i}><b>{m.role}:</b> {typeof m.content === "string" ? m.content : JSON.stringify(m.content)}</p>
        ))}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} style={{ width: "80%" }} />
      <button onClick={send}>Send</button>
    </div>
  );
}
