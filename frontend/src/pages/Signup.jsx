import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, Check, X, ArrowRight } from "lucide-react";
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
    <div className="centered-container">
      <div className="brand-block">
        <div className="brand-name brand-name-solid">
          <span className="brand-name-white">CIR</span><span className="brand-accent">RUS</span>
        </div>
        <div className="brand-tagline">Initialize your workspace.</div>
      </div>

      <div className="centered-card">
        {error && <div className="auth-error">{error.message}</div>}

        <form onSubmit={handleSignup}>
          <label>Username</label>
          <div className="input-icon-wrap">
            <User size={16} className="field-icon" />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoFocus
              required
            />
          </div>

          <label>Email Address</label>
          <div className="input-icon-wrap">
            <Mail size={16} className="field-icon" />
            <input
              type="email"
              value={email}
              onChange={handleEmailChange}
              placeholder="name@company.com"
              className={emailError ? "input-error" : email ? "input-valid" : ""}
              required
            />
            {email && (
              <span className="input-status-icon">
                {emailError ? <X size={16} color="#f87171" /> : <Check size={16} color="#3964fe" />}
              </span>
            )}
          </div>
          {emailError && <div className="field-error">{emailError}</div>}

          <label>Password</label>
          <div className="input-icon-wrap">
            <Lock size={16} className="field-icon" />
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
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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

          <button type="submit" className="centered-btn" disabled={loading}>
            {loading ? <span className="spinner" /> : (
              <>Sign Up <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <p className="centered-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;