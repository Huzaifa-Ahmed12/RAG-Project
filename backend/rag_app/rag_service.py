import os
import uuid
from pgvector.django import CosineDistance
from sentence_transformers import SentenceTransformer
from langchain_community.document_loaders import PDFPlumberLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from .models import Document, Chunk
from django.db import transaction


embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
llm = ChatMistralAI(model="mistral-small-2506")

system = """You are a helpful assistant.
- If the user sends a greeting, respond warmly without searching documents.
- If the user asks a document question, answer ONLY using the provided context.
  If not found, say "I couldn't find that in the document."
"""
human = "Context:{context}\nQuestion:{question}"
prompt = ChatPromptTemplate.from_messages([("system", system), ("human", human)])

greetings = ["hi", "hello", "hey", "how are you", "good morning", "good evening"]


def is_greeting(query):
    cleaned = query.strip().lower().strip("!?. ")
    return any(g in cleaned for g in greetings)


def generate_doc_id():
    return uuid.uuid4().hex[:8]


def embed_text(text):
    return embedding_model.encode(text).tolist()


def generate_summary(chunks):
    sample = " ".join([c.page_content for c in chunks[:6]])[:4000]
    resp = llm.invoke(f"""Summarize this document in 3-4 lines, mentioning key topics:

{sample}

Summary:""")
    return resp.content.strip()


def load_and_chunk(pdf_path, doc_id):
    docs = PDFPlumberLoader(pdf_path).load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=150)
    chunks = splitter.split_documents(docs)
    for c in chunks:
        c.metadata["doc_id"] = doc_id
    return chunks


def process_pdf(pdf_path, filename, user):
    doc_id = generate_doc_id()
    chunks = load_and_chunk(pdf_path, doc_id)
    summary = generate_summary(chunks)

    with transaction.atomic():
        document = Document.objects.create(
            doc_id=doc_id, filename=filename, summary=summary, owner=user
        )


        chunk_objects = [
            Chunk(
                document=document,
                owner=user,
                content=c.page_content,
                embedding=embed_text(c.page_content),
            )
            for c in chunks
        ]
        Chunk.objects.bulk_create(chunk_objects)

    return document


def route_query(query, user):
    documents = Document.objects.filter(owner=user)
    docs_text = " ".join([f"{d.doc_id}:{d.summary}" for d in documents])

    routing_prompt = f"""Document Available: {docs_text}
    Question:"{query}"
    Which doc_id best matches this question? Reply with only the doc_id, nothing else."""

    return llm.invoke(routing_prompt).content.strip()


def is_casual_message(query):
    classification_prompt = f"""Classify the following user message into exactly one category:
- "casual" — greetings, small talk, thanks, goodbyes, or anything not asking about document content
- "question" — a genuine question that requires searching document content

Message: "{query}"

Reply with only one word: casual or question."""

    response = llm.invoke(classification_prompt)
    return response.content.strip().lower() == "casual"


def generate_casual_reply(query):
    casual_prompt = f"""You are a friendly assistant for a document Q&A app.
The user sent a casual message (not a document question): "{query}"

Reply warmly and naturally in 1-2 sentences. You can mention that you're happy 
to help them with questions about their uploaded documents, but keep it light 
and conversational — don't sound robotic or repeat the same phrasing every time."""

    response = llm.invoke(casual_prompt)
    return response.content.strip()


def get_answer(query, user):
    if is_casual_message(query):
        return generate_casual_reply(query), None

    if not Document.objects.filter(owner=user).exists():
        return "No documents have been uploaded yet. Please upload a PDF first.", None

    matched_doc_id = route_query(query, user)
    query_embedding = embed_text(query)

    chunks = (
        Chunk.objects
        .filter(owner=user, document__doc_id=matched_doc_id)
        .order_by(CosineDistance("embedding", query_embedding))[:8]
    )

    if not chunks:
        return "I couldn't find that in the document.", matched_doc_id

    context = " ".join([c.content for c in chunks])
    final_prompt = prompt.invoke({"context": context, "question": query})
    response = llm.invoke(final_prompt)

    return response.content, matched_doc_id


def delete_document(doc_id, user):
    doc = Document.objects.filter(doc_id=doc_id, owner=user).first()
    if not doc:
        return False

    doc.delete()  # cascades: deletes Document row + all its Chunk rows in Postgres
    return True