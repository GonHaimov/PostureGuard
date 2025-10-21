import { Link } from "react-router-dom";
import "./App.css";

import logo from "./assets/logo.png";
import background from "./assets/background.png";

export default function App() {
  const token = localStorage.getItem("token");

  // Extract username from JWT token
  const getUsername = () => {
    if (!token) return null;
    try {
      // JWT tokens have 3 parts separated by dots: header.payload.signature
      const payload = token.split(".")[1];
      // Decode base64 payload
      const decoded = JSON.parse(atob(payload));
      return decoded.username;
    } catch (error) {
      console.error("Error decoding token:", error);
      return null;
    }
  };

  // Capitalize first letter of username
  const capitalizeFirstLetter = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  };

  const username = getUsername();
  const capitalizedUsername = capitalizeFirstLetter(username);

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
                <p>Welcome {capitalizedUsername}, you are logged in.</p>
                <div className="links">
                  <Link to="/calibration" className="btn primary">
                    Calibration
                  </Link>
                  <Link to="/monitoring" className="btn primary">
                    Start Monitoring
                  </Link>
                  <button className="btn logout" onClick={handleLogout}>
                    Logout
                  </button>
                </div>
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
