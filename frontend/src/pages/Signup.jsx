import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Check, X } from "lucide-react";
import "./Auth.css";

const API_BASE = "http://localhost:8000/api";
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getPasswordStrength(password) {
  if (!password) return { label: "", score: 0 };
  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: "Weak", score: 1 };
  if (score <= 3) return { label: "Medium", score: 2 };
  return { label: "Strong", score: 3 };
}

function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const strength = getPasswordStrength(password);

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    if (value && !EMAIL_REGEX.test(value)) {
      setEmailError("Enter a valid email address");
    } else {
      setEmailError(null);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email)) {
      setEmailError("Enter a valid email address");
      return;
    }
    if (!agreedToTerms) {
      setError({ message: "Please agree to the Terms of Service to continue." });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError({ type: data.error, message: data.error || "Signup failed" });
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
    <div className="split-container reverse">
      {/* LEFT — PREVIEW PANEL (swapped side, different content) */}
      <div className="split-right">
        <div className="preview-text">
          <h2>Get started in seconds</h2>
          <p>Create an account, upload your first PDF, and start asking questions — no setup required.</p>
        </div>

        <div className="preview-mockup">
          <div className="mockup-upload-box">
            <div className="mockup-upload-icon">＋</div>
            <div className="mockup-upload-text">Drop PDFs here</div>
          </div>
          <div className="mockup-sidebar" style={{ marginTop: 14 }}>
            <div className="mockup-doc-card">
              <div className="mockup-doc-title">Machine Learning.pdf</div>
              <div className="mockup-doc-line" />
              <div className="mockup-doc-line short" />
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT — FORM PANEL */}
      <div className="split-left">
        <div className="split-form-wrap">
          <div className="brand-mark">📚 DocMind</div>
          <h1 className="split-title">Create Account</h1>
          <p className="split-subtitle">Sign up to start uploading and chatting with your documents</p>

          {error && <div className="auth-error">{error.message}</div>}

          <form onSubmit={handleSignup}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              autoFocus
              required
            />

            <label>Email</label>
            <div className="input-with-icon">
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                placeholder="your@email.com"
                className={emailError ? "input-error" : email ? "input-valid" : ""}
                required
              />
              {email && (
                <span className="input-icon">
                  {emailError ? <X size={16} color="#f87171" /> : <Check size={16} color="#14B8A6" />}
                </span>
              )}
            </div>
            {emailError && <div className="field-error">{emailError}</div>}

            <label>Password</label>
            <div className="password-field">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
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

            {password && (
              <div className="strength-meter">
                <div className="strength-bars">
                  <div className={`strength-bar ${strength.score >= 1 ? "active" : ""} ${strength.label === "Weak" ? "weak" : ""}`} />
                  <div className={`strength-bar ${strength.score >= 2 ? "active" : ""} ${strength.label === "Medium" ? "medium" : ""}`} />
                  <div className={`strength-bar ${strength.score >= 3 ? "active" : ""} ${strength.label === "Strong" ? "strong" : ""}`} />
                </div>
                <span className={`strength-label ${strength.label.toLowerCase()}`}>{strength.label}</span>
              </div>
            )}

            <label className="custom-checkbox terms-checkbox">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span className="checkbox-box"></span>
              I agree to the <a href="#" onClick={(e) => e.stopPropagation()}>Terms of Service</a>
            </label>

            <button type="submit" className="split-btn" disabled={loading}>
              {loading ? <span className="spinner" /> : "Sign Up"}
            </button>
          </form>

          <p className="split-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Signup;