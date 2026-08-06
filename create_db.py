#load the document and splits into chunks->Store in Chroma DB (in-memory, session-scoped)
import os
import uuid
from langchain_community.document_loaders import PDFPlumberLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter


def generate_doc_id():
    return str(uuid.uuid4())[:8]


# Ask the LLM to write a 3-4 line summary from a sample of the document's text.
# Works for ANY subject
def generate_summary(llm, chunks):
    sample_text = " ".join([c.page_content for c in chunks[:6]])[:4000]

    summary_prompt = f"""You are given a sample of text extracted from a document.
Write a short summary of 3 to 4 lines describing what this document covers
(its subject area and key topics). Be specific about the main topics.

Text sample:
{sample_text}

Summary:"""

    response = llm.invoke(summary_prompt)
    return response.content.strip()


def load_and_chunk(pdf_path, doc_id):
    data = PDFPlumberLoader(pdf_path)
    docs = data.load()
    splitters = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=150
    )
    chunks = splitters.split_documents(docs)
    for chunk in chunks:
        chunk.metadata['doc_id'] = doc_id
    return chunks


def add_pdf_to_session(pdf_path, vector_store, metadata, llm):
    """
    Processes one PDF and adds it to the CURRENT SESSION's in-memory
    vector store and metadata dict. Nothing is written to disk.

    vector_store : the session's Chroma instance (in-memory)
    metadata     : the session's dict {doc_id: {filename, summary}}
    llm          : the LLM used to generate the summary

    Returns (doc_id, filename, summary)
    """
    filename = os.path.basename(pdf_path)

    # avoid re-processing the same file twice in one session
    for existing_id, info in metadata.items():
        if info["filename"] == filename:
            return existing_id, filename, info["summary"]

    doc_id = generate_doc_id()
    chunks = load_and_chunk(pdf_path, doc_id)
    summary = generate_summary(llm, chunks)

    vector_store.add_documents(chunks)

    metadata[doc_id] = {
        "filename": filename,
        "summary": summary
    }

    return doc_id, filename, summary