from langchain_core.prompts import ChatPromptTemplate

system = """
You are a helpful assistant. 

- If the user sends a greeting or casual message (like "hello", "hi", "how are you",or any other greeting message), respond naturally and warmly — don't search for it in documents.
- If the user asks a question about the document content, answer ONLY using the provided context. If the answer isn't in the context, say "I couldn't find that in the document."
"""
human = """Context:{context}
    Question:{question}"""
prompt = ChatPromptTemplate.from_messages([
    ("system", system),
    ("human", human)
])

# Simple greeting list for detection
greetings = ["hi", "hello", "hey", "how are you", "good morning", "good evening", "salam", "hii", "helo", "what's up", "how's it going", "hey there", "greetings", "sup", "yo", "good afternoon", "howdy", "hiya"]

def route_query(query, metadata, llm):
    docs_text = " ".join([
        f"{doc_id}:{info['summary']}" for doc_id, info in metadata.items()
    ])

    routing_prompt = f"""Document Available: {docs_text}
    Question:"{query}"
    Which doc_id best matches this question? Reply with only the doc_id, nothing else. """

    response = llm.invoke(routing_prompt)
    return response.content.strip()

def is_greeting(query):
    """Check if query is a greeting"""
    cleaned = query.strip().lower().strip("!?. ")
    
    # Check for exact match or partial match
    for greet in greetings:
        if greet in cleaned or cleaned in greet:
            return True
    
    # Check if it's a general greeting not in our list
    general_greeting_words = ["hey", "hi", "hello", "greetings", "sup", "yo", "howdy"]
    if any(word in cleaned for word in general_greeting_words):
        return True
    
    return False

def get_greeting_response(query, llm):
    """Generate a warm greeting response using LLM"""
    greeting_prompt = f"""
    The user said: "{query}"
    
    This is a casual greeting or small talk. Respond naturally and warmly with 1-2 short sentences.
    Be friendly, engaging, and appropriate for the user's greeting.
    Do NOT mention documents, PDFs, or knowledge base.
    Just respond to their greeting naturally.
    
    Your response:
    """
    
    response = llm.invoke(greeting_prompt)
    return response.content.strip()

def get_answer(query, vector_store, metadata, llm):
    """Always returns a tuple: (answer_text, matched_doc_id_or_None)"""

    # Check greetings FIRST with LLM-generated responses
    if is_greeting(query):
        greeting_response = get_greeting_response(query, llm)
        return greeting_response, None

    if not metadata:
        return "No documents have been uploaded yet. Please upload a PDF first.", None

    matched_doc_id = route_query(query, metadata, llm)

    retriever = vector_store.as_retriever(
        search_type='mmr',
        search_kwargs={
            "k": 8,
            "fetch_k": 12,
            "lambda_mult": 0.5,
            "filter": {"doc_id": matched_doc_id}
        }
    )
    docs = retriever.invoke(query)

    if not docs:
        return "I couldn't find that in the document.", matched_doc_id

    context = " ".join([doc.page_content for doc in docs])

    final_prompt = prompt.invoke({
        "context": context,
        "question": query
    })
    response = llm.invoke(final_prompt)
    return response.content, matched_doc_id