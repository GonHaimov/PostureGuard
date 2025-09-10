import { Link } from "react-router-dom";

export default function App() {
  const token = localStorage.getItem("token");

  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/login";
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>PostureGuard</h1>
      {token ? (
        <div>
          <p>Welcome, you are logged in.</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      ) : (
        <div>
          <p>Please login.</p>
          <Link to="/login">Go to Login</Link><br/>
          <Link to="/register">Create Account</Link>
        </div>
      )}
    </div>
  );
}
