import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import "./Auth.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError({ type: data.error, message: data.message || "Login failed" });
        setLoading(false);
        return;
      }

      localStorage.setItem("access_token", data.access);
      localStorage.setItem("username", data.username);
      navigate("/workspace");
    } catch (err) {
      setError({ type: "network", message: "Something went wrong. Please try again." });
      setLoading(false);
    }
  };

  return (
    <div className="centered-container">
      <div className="brand-block">
        <div className="brand-name">
          CIR<span className="brand-accent">RUS</span>
        </div>
        <div className="brand-tagline">INTELLIGENT VELOCITY</div>
      </div>

      <div className="centered-card">
        <h2 className="card-title">Welcome back</h2>
        <p className="card-subtitle">Log in to access your command center.</p>

        {error && (
          <div className="auth-error">
            {error.message}
            {error.type === "no_account" && (
              <>
                {" "}
                <Link to="/signup" className="auth-inline-link">Create one here</Link>
              </>
            )}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <label>Username</label>
          <div className="input-icon-wrap">
            <User size={16} className="field-icon" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />
          </div>

          <div className="label-row">
            <label>Password</label>
          </div>
          <div className="input-icon-wrap">
            <Lock size={16} className="field-icon" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button type="submit" className="centered-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : (
              <>Log In <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div className="divider">
          <span>or</span>
        </div>

        <p className="centered-switch">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;