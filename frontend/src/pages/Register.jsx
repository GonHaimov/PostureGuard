import { useState } from "react";
import "./Register.css";

import logo from "../assets/logo.png";
import background from "../assets/background.png";

const API = import.meta.env.VITE_API_URL;

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");

    if (password !== confirmPassword) {
      return setMsg("Passwords do not match");
    }

    setMsg("...");

    try {
      const r = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await r.json();
      if (!r.ok) return setMsg(data.error || "error");
      window.location.href = "/login";
    } catch {
      setMsg("network error");
    }
  };

  return (
    <div
      className="register-container"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="overlay">
        <header className="header">
          <img src={logo} alt="PostureGuard Logo" className="logo" />
          <h2 className="title">Register</h2>
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
          <input
            placeholder="Confirm Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn primary">
            Create account
          </button>
        </form>
        <p className="msg">{msg}</p>
        <a href="/login" className="link">
          Back to login
        </a>
      </div>
    </div>
  );
}
