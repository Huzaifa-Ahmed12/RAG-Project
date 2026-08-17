Cirrus — Multi-PDF RAG Assistant

Cirrus is a full-stack Retrieval-Augmented Generation (RAG) application that lets users upload multiple PDFs and chat with them in natural language. Beyond document Q&A, Cirrus provides persistent user authentication and per-user chat history — every document, conversation, and message is scoped to a logged-in user, giving each person their own private workspace.

Live app: rag-project-pink.vercel.app

✨ Features
🔐 JWT-based authentication — secure signup/login, with every document and conversation scoped to the logged-in user
📄 Multi-PDF upload — process and store multiple documents per user
💬 Persistent chat history — conversations are saved and reloadable across sessions
🧠 LLM-based document routing — automatically identifies which uploaded document is most relevant to a given question
🔍 Semantic search via pgvector — cosine similarity search over document embeddings stored directly in PostgreSQL
🗣️ Casual message detection — distinguishes greetings/small talk from real document questions, so the assistant doesn't awkwardly search documents for a "hi"
🗑️ Full document & conversation management — delete documents or chats, with confirmation modals
📱 Responsive UI — collapsible sidebar, mobile-friendly chat interface
🏗️ Architecture & Pipeline
PDF Upload → PDFPlumber text extraction → Recursive chunking
    → Batch embedding (Sentence-Transformers) → pgvector storage (Postgres)

User Question → Casual/question classification → LLM-based document routing
    → Cosine similarity search (pgvector) → Context retrieval
    → Mistral AI generates grounded answer
🛠️ Tech Stack

Frontend

React (Vite)
Lucide React (icons)
Deployed on Vercel

Backend

Django + Django REST Framework
Simple JWT (authentication)
django-cors-headers
Deployed on Railway

AI / RAG

LangChain
Mistral AI (LLM — chat, summarization, routing, classification)
Sentence-Transformers (all-MiniLM-L6-v2) for embeddings
PDFPlumber (PDF text extraction — chosen for reliable extraction from tables and multi-column layouts)

Database

PostgreSQL with the pgvector extension (hosted on Supabase)
Embeddings and relational data (users, documents, conversations, messages) live in a single database — no separate vector store to sync
