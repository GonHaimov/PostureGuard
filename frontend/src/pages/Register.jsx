import { useState } from "react";
const API = import.meta.env.VITE_API_URL;

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("")
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (password != confirmPassword) {
        return setMsg("Password do not match")
    }

    setMsg("...");
    
    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      const data = await r.json();
      if (!r.ok) return setMsg(data.error || "error");
      window.location.href = "/login";
    } catch {
      setMsg("network error");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 540 }}>
      <h2>Register</h2>
      <form onSubmit={onSubmit}>
        <input placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} required />
        <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
        <input placeholder="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
        <button type="submit">Create account</button>
      </form>
      <p>{msg}</p>
      <a href="/login">Back to login</a>
    </div>
  );
}
