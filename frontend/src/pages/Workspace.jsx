import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu, X, FileText, Send, Trash2, LogOut, Plus,
  Upload, Sparkles, ShieldAlert, Paperclip, Zap
} from "lucide-react";
import "../App.css";

const API_BASE = "http://localhost:8000/api";

const SUGGESTIONS = [
  { label: "Summarize Key Metrics", icon: Sparkles },
  { label: "Identify Risks", icon: ShieldAlert },
];

function Workspace() {
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Upload a PDF and ask me anything about it." }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [convToDelete, setConvToDelete] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();

  const username = localStorage.getItem("username");
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
        setMessages([{ role: "assistant", content: "Hi! Upload a PDF and ask me anything about it." }]);
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
    setMessages([{ role: "assistant", content: "Hi! Upload a PDF and ask me anything about it." }]);
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
        setDocuments((prev) => [...prev, { doc_id: data.doc_id, filename: data.filename }]);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Document processed and stored: ${data.filename}`, isUpload: true, filename: data.filename },
        ]);
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
    <div className={`app-container ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-top">
          <div className="brand-name-mini">
            CIR<span className="brand-accent">RUS</span>
          </div>
          <button className="icon-btn sidebar-close-btn" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </button>
        </div>
        <div className="sidebar-subtitle">Signed in as {username}</div>

        <label className="upload-box">
          <input
            type="file"
            accept="application/pdf"
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <Upload size={18} className="upload-icon" />
          <p>Drop PDFs here or <span>browse</span></p>
        </label>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((file, idx) => (
              <div className="file-chip" key={idx}>
                <span>{file.name}</span>
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
        <div className="scroll-section docs-scroll">
          {documents.length === 0 && (
            <div className="sidebar-subtitle">No documents uploaded yet.</div>
          )}
          {documents.map((doc, idx) => (
            <div className="doc-card" key={idx}>
              <div className="doc-card-icon">
                <FileText size={16} />
              </div>
              <div className="doc-card-body">
                <b>{doc.filename}</b>
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
            <div className="sidebar-subtitle">No conversations yet.</div>
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
          <div>
            <h2>Cirrus AI</h2>
            <p>Ask a question — only the relevant document is searched</p>
          </div>
        </div>

        <div className="messages-container">
          {messages.map((msg, idx) => (
            <div className={`message-row ${msg.role}`} key={idx}>
              <div className={`avatar ${msg.role}`}>
                {msg.role === "user" ? username.charAt(0).toUpperCase() : <Zap size={14} />}
              </div>
              <div className="message-col">
                <div className={`message-bubble ${msg.isUpload ? "message-bubble-upload" : ""}`}>
                  {msg.isUpload && <FileText size={15} className="upload-msg-icon" />}
                  {msg.content}
                </div>
                {msg.source && (
                  <div className="source-tag">
                    <FileText size={12} /> Answered from: {msg.source}
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
              <div className="avatar assistant"><Zap size={14} /></div>
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
          <div className="input-pills">
            <button className="pill-btn" type="button">
              <Zap size={13} /> Add Action
            </button>
            <button className="pill-btn" type="button">
              <Paperclip size={13} /> Add Source
            </button>
          </div>
          <div className="input-row">
            <input
              type="text"
              placeholder="Ask about your documents..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="send-btn" onClick={handleSend}>
              <Send size={16} />
            </button>
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
  );
}

export default Workspace;