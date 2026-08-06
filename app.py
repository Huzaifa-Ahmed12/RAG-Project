import os
import shutil
import tempfile
import streamlit as st

from langchain_mistralai import ChatMistralAI
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from dotenv import load_dotenv
load_dotenv()

from create_db import add_pdf_to_session, load_and_chunk, generate_summary, generate_doc_id
from main import get_answer

st.set_page_config(
    page_title="Multi-Book RAG Assistant",
    page_icon="📚",
    layout="wide"
)

# ----------------------------
# Styling
# ----------------------------
st.markdown("""
    <style>
    .title-container { text-align: center; padding: 10px 0 10px 0; }
    .title-container h1 { font-size: 2.1rem; margin-bottom: 0px; }
    .title-container p { color: #9ca3af; font-size: 0.95rem; margin-top: 4px; }
    .doc-card {
        background-color: #1f2937;
        border: 1px solid #374151;
        border-radius: 10px;
        padding: 12px;
        margin-bottom: 10px;
    }
    .doc-card b { color: #e5e7eb; }
    .doc-card p { color: #9ca3af; font-size: 0.85rem; margin: 4px 0 0 0; }
    </style>
""", unsafe_allow_html=True)

st.markdown("""
    <div class="title-container">
        <h1>📚 Multi-Book RAG Assistant</h1>
        <p>Upload PDFs for this session — everything is cleared when the app closes</p>
    </div>
""", unsafe_allow_html=True)


# ----------------------------
# Shared, expensive-to-load resources (model weights) — cached across ALL sessions,
# but hold NO document data themselves.
# ----------------------------
@st.cache_resource(show_spinner="Loading models...")
def load_models():
    embeddings_model = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    llm = ChatMistralAI(model="mistral-small-2506")
    return embeddings_model, llm


embeddings_model, llm = load_models()


# ----------------------------
# Session-scoped state — unique per browser session, in-memory only.
# Nothing here touches disk except a temp folder for uploaded files,
# which is deleted automatically when the session ends.
# ----------------------------
if "vector_store" not in st.session_state:
    # In-memory Chroma — no persist_directory means nothing is saved to disk
    st.session_state.vector_store = Chroma(embedding_function=embeddings_model)

if "doc_metadata" not in st.session_state:
    st.session_state.doc_metadata = {}

if "temp_dir" not in st.session_state:
    st.session_state.temp_dir = tempfile.mkdtemp(prefix="rag_session_")

if "messages" not in st.session_state:
    st.session_state.messages = [
        {"role": "assistant", "content": "Hi! Upload a PDF and ask me anything about it 📖"}
    ]


# ----------------------------
# Sidebar — Upload PDFs (session only)
# ----------------------------
with st.sidebar:
    st.markdown("### 📤 Upload Documents")
    st.caption("Files are only kept for this session and deleted when you close the app.")

    uploaded_files = st.file_uploader(
        "Upload one or more PDFs",
        type=["pdf"],
        accept_multiple_files=True
    )

    if uploaded_files:
        if st.button("Process Uploaded PDFs", use_container_width=True):
            total_files = len(uploaded_files)
            progress_bar = st.progress(0, text="Starting...")

            for file_index, uploaded_file in enumerate(uploaded_files):
                filename = uploaded_file.name

                # Skip if already processed in this session
                already_done = any(
                    info["filename"] == filename
                    for info in st.session_state.doc_metadata.values()
                )
                if already_done:
                    progress_bar.progress(
                        (file_index + 1) / total_files,
                        text=f"Skipped (already added): {filename}"
                    )
                    continue

                base = file_index / total_files
                step = 1 / total_files  # how much this one file contributes to overall progress

                # Stage 1: save file to temp folder (0% -> 10% of this file's share)
                progress_bar.progress(base + step * 0.05, text=f"Saving {filename}...")
                save_path = os.path.join(st.session_state.temp_dir, filename)
                with open(save_path, "wb") as f:
                    f.write(uploaded_file.getbuffer())

                # Stage 2: extract + chunk (10% -> 40%)
                progress_bar.progress(base + step * 0.15, text=f"Extracting text from {filename}...")
                doc_id = generate_doc_id()
                chunks = load_and_chunk(save_path, doc_id)
                progress_bar.progress(base + step * 0.40, text=f"Split {filename} into {len(chunks)} chunks...")

                # Stage 3: generate summary via LLM (40% -> 70%)
                progress_bar.progress(base + step * 0.50, text=f"Summarizing {filename}...")
                summary = generate_summary(llm, chunks)
                progress_bar.progress(base + step * 0.70, text=f"Summary ready for {filename}...")

                # Stage 4: embed + store chunks (70% -> 100%)
                progress_bar.progress(base + step * 0.80, text=f"Embedding chunks for {filename}...")
                st.session_state.vector_store.add_documents(chunks)
                st.session_state.doc_metadata[doc_id] = {
                    "filename": filename,
                    "summary": summary
                }

                progress_bar.progress((file_index + 1) / total_files, text=f"✅ Done: {filename}")

            progress_bar.progress(1.0, text="All files processed!")
            st.rerun()

    st.markdown("---")
    st.markdown("### 📖 Documents in this session")

    if not st.session_state.doc_metadata:
        st.caption("No documents uploaded yet.")
    else:
        for doc_id, info in st.session_state.doc_metadata.items():
            st.markdown(f"""
                <div class="doc-card">
                    <b>{info['filename']}</b>
                    <p>{info['summary']}</p>
                </div>
            """, unsafe_allow_html=True)

    st.markdown("---")
    if st.button("🗑️ Clear Session (delete all docs)", use_container_width=True):
        # Wipe in-memory vector store and metadata
        st.session_state.vector_store = Chroma(embedding_function=embeddings_model)
        st.session_state.doc_metadata = {}

        # Wipe temp files on disk
        shutil.rmtree(st.session_state.temp_dir, ignore_errors=True)
        st.session_state.temp_dir = tempfile.mkdtemp(prefix="rag_session_")

        st.session_state.messages = [
            {"role": "assistant", "content": "Session cleared. Upload a new PDF to start again 📖"}
        ]
        st.rerun()


# ----------------------------
# Chat
# ----------------------------
for msg in st.session_state.messages:
    avatar = "🧑‍💻" if msg["role"] == "user" else "📚"
    with st.chat_message(msg["role"], avatar=avatar):
        st.markdown(msg["content"])
        if msg.get("routed_to"):
            st.caption(f"📄 Answered from: {msg['routed_to']}")

user_input = st.chat_input("Ask a question about your uploaded documents...")

if user_input:
    st.session_state.messages.append({"role": "user", "content": user_input})
    with st.chat_message("user", avatar="🧑‍💻"):
        st.markdown(user_input)

    with st.chat_message("assistant", avatar="📚"):
        with st.spinner("Thinking..."):
            answer, matched_doc_id = get_answer(
                user_input,
                st.session_state.vector_store,
                st.session_state.doc_metadata,
                llm
            )

        routed_filename = None
        if matched_doc_id and matched_doc_id in st.session_state.doc_metadata:
            routed_filename = st.session_state.doc_metadata[matched_doc_id]["filename"]

        st.markdown(answer)
        if routed_filename:
            st.caption(f"📄 Answered from: {routed_filename}")

    st.session_state.messages.append({
        "role": "assistant",
        "content": answer,
        "routed_to": routed_filename
    })