import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import "./Auth.css";

const API_BASE = "http://localhost:8000/api";

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
    <div className="split-container">
      {/* LEFT — FORM PANEL */}
      <div className="split-left">
        <div className="split-form-wrap">
          <div className="brand-mark">📚 DocMind</div>
          <h1 className="split-title">Welcome Back</h1>
          <p className="split-subtitle">Log in to chat with your documents</p>

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
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoFocus
              required
            />

            <label>Password</label>
            <div className="password-field">
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
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <button type="submit" className="split-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : "Log In"}
            </button>
          </form>

          <p className="split-switch">
            Don't have an account? <Link to="/signup">Sign up</Link>
          </p>
        </div>
      </div>

      {/* RIGHT — PREVIEW PANEL */}
      <div className="split-right">
        <div className="preview-text">
          <h2>Chat with all your documents at once</h2>
          <p>Upload multiple PDFs, ask a question, and get answers pulled from exactly the right document — automatically.</p>
        </div>

        <div className="preview-mockup">
          <div className="mockup-sidebar">
            <div className="mockup-doc-card">
              <div className="mockup-doc-title">Deep Learning.pdf</div>
              <div className="mockup-doc-line" />
              <div className="mockup-doc-line short" />
            </div>
            <div className="mockup-doc-card">
              <div className="mockup-doc-title">Finance.pdf</div>
              <div className="mockup-doc-line" />
              <div className="mockup-doc-line short" />
            </div>
          </div>

          <div className="mockup-chat">
            <div className="mockup-bubble assistant">Ask me anything about your documents 📖</div>
            <div className="mockup-bubble user">Explain CNN architecture</div>
            <div className="mockup-bubble assistant">A CNN uses convolutional layers to extract spatial features...</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;