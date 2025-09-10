import { useState } from "react";

const API = import.meta.env.VITE_API_URL;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("...");
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) return setMsg(data.error || "error");
      localStorage.setItem("token", data.token);
      setMsg("ok");
      window.location.href = "/";
    } catch {
      setMsg("network error");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h2>Login</h2>
      <form onSubmit={onSubmit}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <button type="submit">Login</button>
      </form>
      <p>{msg}</p>
      <a href="/register">Create account</a>
    </div>
  );
}
