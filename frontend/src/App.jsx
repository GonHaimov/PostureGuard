import { Link } from "react-router-dom";
import "./App.css";

import logo from "./assets/logo.png";
import background from "./assets/background.png";

export default function App() {
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div
      className="home-container"
      style={{ backgroundImage: `url(${background})` }}
    >
      <div className="overlay">
        <header className="header">
          <img src={logo} alt="PostureGuard Logo" className="logo" />
          <h1 className="title">PostureGuard</h1>
          <p className="subtitle">
            Keep your posture healthy while working on your computer
          </p>
        </header>

        <main className="content">
          <div className="card">
            {token ? (
              <>
                <p>Welcome, you are logged in.</p>
                <button className="btn logout" onClick={handleLogout}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <p>Please login to get started.</p>
                <div className="links">
                  <Link to="/login" className="btn primary">
                    Go to Login
                  </Link>
                  <Link to="/register" className="btn secondary">
                    Create Account
                  </Link>
                </div>
              </>
            )}
          </div>
        </main>

        <footer className="footer">
          <p>© {new Date().getFullYear()} PostureGuard. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
