import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, X, FileText, Send, Trash2, LogOut, Plus,
  Upload, Sparkles, ShieldAlert, Cloud, User, Bot
} from "lucide-react";
import "../App.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api";

const SUGGESTIONS = [
  { label: "Summarize Key Metrics", icon: Sparkles },
  { label: "Identify Risks", icon: ShieldAlert },
];

function renderFormattedContent(text) {
  if (!text) return null;

  const lines = text.split("\n");

  return lines.map((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return <div key={idx} style={{ height: "6px" }} />;

    if (trimmed.startsWith("###") || trimmed.startsWith("##") || trimmed.startsWith("#")) {
      const cleanHead = trimmed.replace(/^#+\s*/, "");
      return <h4 key={idx} className="msg-heading">{cleanHead}</h4>;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const title = trimmed.replace(/^\d+\.\s+/, "");
      return <h5 key={idx} className="msg-subheading">{title}</h5>;
    }

    if (trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*")) {
      const itemText = trimmed.replace(/^[•\-\*]\s*/, "");
      const colonIdx = itemText.indexOf(":");
      if (colonIdx > 0 && colonIdx < 30) {
        const label = itemText.substring(0, colonIdx + 1);
        const rest = itemText.substring(colonIdx + 1);
        return (
          <li key={idx} className="msg-bullet">
            <strong>{label}</strong>{rest}
          </li>
        );
      }
      return <li key={idx} className="msg-bullet">{itemText}</li>;
    }

    if (trimmed.includes("**")) {
      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className="msg-p">
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return <strong key={pIdx}>{part.slice(2, -2)}</strong>;
            }
            return part;
          })}
        </p>
      );
    }

    return <p key={idx} className="msg-p">{trimmed}</p>;
  });
}

function Workspace() {
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Upload a PDF using the button below and ask me anything about it." }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [convToDelete, setConvToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const username = localStorage.getItem("username") || "User";
  const token = localStorage.getItem("access_token");

  const authHeaders = (extra = {}) => ({
    Authorization: `Bearer ${token}`,
    ...extra,
  });

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("username");
    navigate("/login");
  };

  const confirmLogout = () => {
    handleLogout();
    setShowLogoutConfirm(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [docsRes, convRes] = await Promise.all([
          fetch(`${API_BASE}/documents/`, { headers: authHeaders() }),
          fetch(`${API_BASE}/conversations/`, { headers: authHeaders() }),
        ]);

        if (docsRes.status === 401 || convRes.status === 401) {
          handleLogout();
          return;
        }

        const docsData = await docsRes.json();
        const convData = await convRes.json();

        setDocuments(docsData);
        setConversations(convData);

        if (convData.length > 0) {
          await loadConversation(convData[0].id);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      }
    };
    fetchInitialData();
  }, []);

  const loadConversation = async (conversationId) => {
    try {
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages/`, {
        headers: authHeaders(),
      });
      if (res.status === 401) {
        handleLogout();
        return;
      }
      const data = await res.json();

      if (data.length === 0) {
        setMessages([{ role: "assistant", content: "Hi! Upload a PDF using the button below and ask me anything about it." }]);
      } else {
        setMessages(data.map((m) => ({ role: m.role, content: m.content, source: m.source })));
      }
      setCurrentConversationId(conversationId);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    }
  };

  const startNewChat = () => {
    setCurrentConversationId(null);
    setMessages([{ role: "assistant", content: "Hi! Upload a PDF using the button below and ask me anything about it." }]);
  };

  const refreshConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/conversations/`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to refresh conversations:", err);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    try {
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (res.ok) {
        setConversations((prev) => prev.filter((c) => c.id !== conversationId));
        if (conversationId === currentConversationId) {
          startNewChat();
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const processUploadFiles = async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setProcessing(true);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgressText(`Uploading ${file.name}...`);
      setProgress(Math.round(((i + 0.3) / selectedFiles.length) * 100));

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
        setDocuments((prev) => [...prev, { doc_id: data.doc_id, filename: data.filename }]);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Document processed and stored: ${data.filename}`, isUpload: true, filename: data.filename },
        ]);
      } catch (err) {
        console.error("Upload failed:", err);
      }

      setProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
    }

    setProgressText("All files processed!");
    setFiles([]);
    setTimeout(() => {
      setProcessing(false);
      setProgress(0);
      setProgressText("");
    }, 1200);
  };

  const handleFileSelect = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
      setFiles(selected);
      processUploadFiles(selected);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}/`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (res.status === 401) {
        handleLogout();
        return;
      }

      if (res.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.doc_id !== docId));
      }
    } catch (err) {
      console.error("Failed to delete document:", err);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;

    const userMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch(`${API_BASE}/chat/`, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          question: userMessage.content,
          conversation_id: currentConversationId,
        }),
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

      if (!currentConversationId && data.conversation_id) {
        setCurrentConversationId(data.conversation_id);
        refreshConversations();
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const handleSend = () => sendMessage(input);
  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSend();
  };

  return (
    <div className="page-wrapper">
      {/* TOP NAVBAR */}
      <header className="top-navbar">
        <div className="navbar-brand">
          <div className="brand-logo-icon">
            <Cloud size={20} />
          </div>
          <div className="brand-name">
            CIR<span className="brand-accent">RUS</span>
          </div>
        </div>
        <div className="navbar-user">
          <div className="user-avatar-btn" title={`Signed in as ${username}`}>
            <User size={18} />
          </div>
        </div>
      </header>

      <div className={`app-container ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
        {/* SIDEBAR */}
        <div className="sidebar">
          <div className="sidebar-top">
            <div className="sidebar-header-info">
              <h3 className="sidebar-title">Workspace</h3>
              <span className="sidebar-subtitle">Signed in as {username}</span>
            </div>
            <button className="icon-btn sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
              <X size={16} />
            </button>
          </div>

          <div className="section-label">Your Documents</div>
          <div className="scroll-section docs-scroll">
            {documents.length === 0 && (
              <div className="empty-state-text">No documents uploaded yet.</div>
            )}
            {documents.map((doc, idx) => (
              <div className="doc-card" key={idx}>
                <div className="doc-card-icon">
                  <FileText size={16} />
                </div>
                <div className="doc-card-body">
                  <b title={doc.filename}>{doc.filename}</b>
                  <span className="doc-status">Analyzed</span>
                </div>
                <button
                  className="doc-delete-btn"
                  onClick={() => setDocToDelete(doc.doc_id)}
                  title="Delete document"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="section-label conversations-label">
            Chats
            <button className="new-chat-btn" onClick={startNewChat} title="Start new chat">
              <Plus size={13} /> New
            </button>
          </div>
          <div className="scroll-section chats-scroll">
            {conversations.length === 0 && (
              <div className="empty-state-text">No conversations yet.</div>
            )}
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`conversation-item-wrap ${conv.id === currentConversationId ? "active" : ""}`}
              >
                <button
                  className="conversation-item"
                  onClick={() => loadConversation(conv.id)}
                >
                  {conv.title}
                </button>
                <button
                  className="conv-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConvToDelete(conv.id);
                  }}
                  title="Delete conversation"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <button className="logout-btn" onClick={() => setShowLogoutConfirm(true)}>
            <LogOut size={15} /> Logout
          </button>
        </div>

        {/* SIDEBAR OVERLAY (mobile) */}
        {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

        {/* CHAT AREA */}
        <div className="chat-area">
          <div className="chat-header">
            {!sidebarOpen && (
              <button className="icon-btn menu-toggle-btn" onClick={() => setSidebarOpen(true)}>
                <Menu size={18} />
              </button>
            )}
            <div className="chat-header-text">
              <p className="chat-header-sub">Ask a question — only the relevant document is searched</p>
            </div>
          </div>

          <div className="messages-container">
            {messages.map((msg, idx) => (
              <div className={`message-row ${msg.role}`} key={idx}>
                <div className={`avatar ${msg.role}`}>
                  {msg.role === "user" ? username.charAt(0).toUpperCase() : <Bot size={18} />}
                </div>
                <div className="message-col">
                  <div className={`message-bubble ${msg.isUpload ? "message-bubble-upload" : ""}`}>
                    {msg.isUpload && <FileText size={16} className="upload-msg-icon" />}
                    {msg.role === "assistant" ? renderFormattedContent(msg.content) : msg.content}
                  </div>
                  {msg.source && (
                    <div className="source-tag">
                      <FileText size={12} /> Answered from: <span>{msg.source}</span>
                    </div>
                  )}
                  {idx === 0 && msg.role === "assistant" && documents.length > 0 && (
                    <div className="suggestion-chips">
                      {SUGGESTIONS.map((s, i) => (
                        <button
                          key={i}
                          className="suggestion-chip"
                          onClick={() => sendMessage(s.label)}
                        >
                          <s.icon size={13} /> {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="message-row assistant">
                <div className="avatar assistant"><Bot size={18} /></div>
                <div className="message-bubble typing-bubble">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-area">
            {processing && (
              <div className="upload-progress-box">
                <div className="progress-info">
                  <Upload size={14} className="spin-icon" />
                  <span>{progressText}</span>
                </div>
                <div className="progress-bar-outer">
                  <div className="progress-bar-inner" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}

            <div className="input-pills">
              <button
                className="pill-btn pill-btn-primary"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={processing}
              >
                <Upload size={13} /> Upload PDF
              </button>
              <input
                type="file"
                ref={fileInputRef}
                accept="application/pdf"
                multiple
                hidden
                onChange={handleFileSelect}
              />
            </div>
            <div className="input-row">
              <input
                type="text"
                placeholder="Ask about your documents..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="send-btn" onClick={handleSend} title="Send message">
                <Send size={18} />
              </button>
            </div>
            <div className="input-disclaimer">
              CIRRUS AI can make mistakes. Consider verifying important information.
            </div>
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

        {/* DELETE DOCUMENT CONFIRMATION MODAL */}
        {docToDelete && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>Delete document?</h3>
              <p>This will permanently remove the document and all its data. This can't be undone.</p>
              <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={() => setDocToDelete(null)}>
                  Cancel
                </button>
                <button
                  className="modal-btn-confirm"
                  onClick={async () => {
                    await handleDeleteDocument(docToDelete);
                    setDocToDelete(null);
                  }}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DELETE CONVERSATION CONFIRMATION MODAL */}
        {convToDelete && (
          <div className="modal-overlay">
            <div className="modal-card">
              <h3>Delete conversation?</h3>
              <p>This chat and all its messages will be permanently deleted. This can't be undone.</p>
              <div className="modal-actions">
                <button className="modal-btn-cancel" onClick={() => setConvToDelete(null)}>
                  Cancel
                </button>
                <button
                  className="modal-btn-confirm"
                  onClick={async () => {
                    await handleDeleteConversation(convToDelete);
                    setConvToDelete(null);
                  }}
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Workspace;