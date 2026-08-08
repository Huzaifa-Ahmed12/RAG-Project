import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../App.css";

const API_BASE = "http://localhost:8000/api";

function Workspace() {
  const [files, setFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Upload a PDF and ask me anything about it 📖" }
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [docToDelete, setDocToDelete] = useState(null);
  const [convToDelete, setConvToDelete] = useState(null);

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
        setMessages([{ role: "assistant", content: "Hi! Upload a PDF and ask me anything about it 📖" }]);
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
    setMessages([{ role: "assistant", content: "Hi! Upload a PDF and ask me anything about it 📖" }]);
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

  // ---- Delete a conversation (removes from PostgreSQL + admin panel) ----
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

        // If the deleted conversation was the one currently open, reset to a fresh chat
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
        // Store only filename/doc_id for the sidebar card — summary stays in the database only
        setDocuments((prev) => [...prev, { doc_id: data.doc_id, filename: data.filename }]);

        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `📄 Document processed and stored: ${data.filename}` },
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
        <div className="scroll-section docs-scroll">
          {documents.length === 0 && (
            <div className="sidebar-subtitle">No documents uploaded yet.</div>
          )}
          {documents.map((doc, idx) => (
            <div className="doc-card" key={idx}>
              <div className="doc-card-header">
                <b>{doc.filename}</b>
                <button
                  className="doc-delete-btn"
                  onClick={() => setDocToDelete(doc.doc_id)}
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="section-label conversations-label">
          Chats
          <button className="new-chat-btn" onClick={startNewChat} title="Start new chat">
            + New
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
                🗑️
              </button>
            </div>
          ))}
        </div>

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
                {msg.role === "user" ? username.charAt(0).toUpperCase() : "AI"}
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
              <div className="avatar assistant">AI</div>
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