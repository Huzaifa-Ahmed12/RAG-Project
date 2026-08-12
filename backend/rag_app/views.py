import os
import tempfile
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Document, Conversation, Message
from . import rag_service


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_pdf(request):
    file = request.FILES.get("file")
    if not file:
        return Response({"error": "No file provided"}, status=400)

    # Write to a temporary file just so PDFPlumberLoader can read it —
    # deleted automatically once processing finishes, nothing persists to disk
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        for chunk in file.chunks():
            tmp.write(chunk)
        tmp_path = tmp.name

    try:
        # Pass the logged-in user so the document is tagged to them
        doc = rag_service.process_pdf(tmp_path, file.name, request.user)
    finally:
        os.remove(tmp_path)  # always clean up, even if processing fails

    return Response({
        "doc_id": doc.doc_id,
        "filename": doc.filename,
        "summary": doc.summary
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_documents(request):
    docs = Document.objects.filter(owner=request.user).order_by("-uploaded_at")
    return Response([
        {"doc_id": d.doc_id, "filename": d.filename, "summary": d.summary}
        for d in docs
    ])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_document(request, doc_id):
    doc = Document.objects.filter(doc_id=doc_id, owner=request.user).first()
    if not doc:
        return Response({"error": "Document not found"}, status=404)

    rag_service.delete_document(doc_id, request.user)
    return Response({"status": "deleted"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def chat(request):
    question = request.data.get("question")
    conversation_id = request.data.get("conversation_id")

    if conversation_id:
        conversation = Conversation.objects.filter(id=conversation_id, owner=request.user).first()
        if not conversation:
            return Response({"error": "Conversation not found"}, status=404)
    else:
        conversation = Conversation.objects.create(title=question[:50], owner=request.user)

    Message.objects.create(conversation=conversation, role="user", content=question)

    answer, matched_doc_id = rag_service.get_answer(question, request.user)

    source_filename = None
    if matched_doc_id:
        doc = Document.objects.filter(doc_id=matched_doc_id, owner=request.user).first()
        source_filename = doc.filename if doc else None

    Message.objects.create(
        conversation=conversation, role="assistant",
        content=answer, source_document=source_filename
    )

    return Response({
        "answer": answer,
        "source_filename": source_filename,
        "conversation_id": conversation.id
    })


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_conversations(request):
    conversations = Conversation.objects.filter(owner=request.user).order_by("-created_at")
    return Response([{"id": c.id, "title": c.title} for c in conversations])


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_conversation_messages(request, conversation_id):
    conversation = Conversation.objects.filter(id=conversation_id, owner=request.user).first()
    if not conversation:
        return Response({"error": "Conversation not found"}, status=404)

    messages = Message.objects.filter(conversation=conversation).order_by("created_at")
    return Response([
        {"role": m.role, "content": m.content, "source": m.source_document}
        for m in messages
    ])


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_conversation(request, conversation_id):
    conversation = Conversation.objects.filter(id=conversation_id, owner=request.user).first()
    if not conversation:
        return Response({"error": "Conversation not found"}, status=404)

    conversation.delete()
    return Response({"status": "deleted"})