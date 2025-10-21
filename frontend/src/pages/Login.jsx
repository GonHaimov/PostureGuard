import { useState } from "react";
import "./Login.css";

import logo from "../assets/logo.png";
import background from "../assets/background.png";

const API = import.meta.env.VITE_API_URL;

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("...");
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
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
    <div
      className="login-container"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="overlay">
        <header className="header">
          <img src={logo} alt="PostureGuard Logo" className="logo" />
          <h2 className="title">Login</h2>
        </header>

        <form className="form" onSubmit={onSubmit}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn primary">
            Login
          </button>
        </form>
        <p className="msg">{msg}</p>
        <a href="/register" className="link">
          Create account
        </a>
      </div>
    </div>
  );
}
