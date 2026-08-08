import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const API_BASE = "http://localhost:8000/api";

function Workspace() {
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Upload a PDF and ask me anything about it 📖" }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const username = localStorage.getItem("username");
  const token = localStorage.getItem("access_token");

  // Helper: attach auth header to every request
  const authHeaders = (extra = {}) => ({
    Authorization: `Bearer ${token}`,
    ...extra,
  });

  // Used for automatic logout (e.g. expired token) — no confirmation needed
  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  // Used when the user manually clicks Logout and confirms the modal
  const confirmLogout = () => {
    handleLogout();
    setShowLogoutConfirm(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load existing documents when the workspace first opens
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await fetch(`${API_BASE}/documents/`, {
          headers: authHeaders(),
        });
        if (res.status === 401) {
          handleLogout();
          return;
        }
        const data = await res.json();
        setDocuments(data);
      } catch (err) {
        console.error("Failed to load documents:", err);
      }
    };
    fetchDocuments();
  }, []);

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...selected]);
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleProcess = async () => {
    if (files.length === 0) return;
    setProcessing(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressText(`Uploading ${file.name}...`);
      setProgress(Math.round(((i + 0.3) / files.length) * 100));

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API_BASE}/upload/`, {
          method: "POST",
          headers: authHeaders(),
          body: formData,
        });

        if (res.status === 401) {
          handleLogout();
          return;
        }

        const data = await res.json();
        setProgressText(`Processed ${file.name}`);
        setDocuments((prev) => [...prev, data]);
      } catch (err) {
        console.error("Upload failed:", err);
      }

      setProgress(Math.round(((i + 1) / files.length) * 100));
    }

    setProgressText("All files processed!");
    setFiles([]);
    setTimeout(() => {
      setProcessing(false);
      setProgress(0);
      setProgressText("");
    }, 1000);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ question: userMessage.content }),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, source: data.source_filename },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="app-container">
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-title">📚 RAG Assistant</div>
        <div className="sidebar-subtitle">Signed in as {username}</div>

        <label className="upload-box">
          <input
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <p>Drop PDFs here or <span>browse</span></p>
        </label>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((file, idx) => (
              <div className="file-chip" key={idx}>
                {file.name}
                <button onClick={() => removeFile(idx)}>×</button>
              </div>
            ))}
          </div>
        )}

        {files.length > 0 && (
          <button className="process-btn" onClick={handleProcess} disabled={processing}>
            {processing ? "Processing..." : "Process Uploaded PDFs"}
          </button>
        )}

        {processing && (
          <>
            <div className="progress-bar-outer">
              <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
            </div>
            <div className="sidebar-subtitle" style={{ marginTop: -12 }}>{progressText}</div>
          </>
        )}

        <div className="section-label">Your Documents</div>
        {documents.length === 0 && (
          <div className="sidebar-subtitle">No documents uploaded yet.</div>
        )}
        {documents.map((doc, idx) => (
          <div className="doc-card" key={idx}>
            <b>{doc.filename}</b>
            <p>{doc.summary}</p>
          </div>
        ))}

        <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
          Logout
        </button>
      </div>

      {/* CHAT AREA */}
      <div className="chat-area">
        <div className="chat-header">
          <h2>Chat</h2>
          <p>Ask a question — only the relevant document is searched</p>
        </div>

        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div className={`message-row ${msg.role}`} key={idx}>
              <div className={`avatar ${msg.role}`}>
                {msg.role === "user" ? "🧑‍💻" : "📚"}
              </div>
              <div>
                <div className="message-bubble">{msg.content}</div>
                {msg.source && (
                  <div className="source-tag">📄 Answered from: {msg.source}</div>
                )}
              </div>
            </div>
          ))}
          {thinking && (
            <div className="message-row assistant">
              <div className="avatar assistant">📚</div>
              <div className="message-bubble">Thinking...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <input
            type="text"
            placeholder="Ask a question about your uploaded documents..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="send-btn" onClick={handleSend}>➤</button>
        </div>
      </div>

      {/* LOGOUT CONFIRMATION MODAL */}
      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Log out?</h3>
            <p>Are you sure you want to log out of your account?</p>
            <div className="modal-actions">
              <button className="modal-btn-cancel" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="modal-btn-confirm" onClick={confirmLogout}>
                Yes, Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Workspace;