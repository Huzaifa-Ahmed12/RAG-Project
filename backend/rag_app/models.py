from django.db import models
from django.contrib.auth.models import User
import uuid


def generate_doc_id():
    return uuid.uuid4().hex[:8]


class Document(models.Model):
    doc_id = models.CharField(max_length=20, unique=True, default=generate_doc_id)
    filename = models.CharField(max_length=255)
    summary = models.TextField()
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="documents")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.filename


class Conversation(models.Model):
    title = models.CharField(max_length=255, default="New Conversation")
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="conversations")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.owner.username})"
class Message(models.Model):
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20)
    content = models.TextField()
    source_document = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        preview = self.content[:40] + "..." if len(self.content) > 40 else self.content
        return f"{self.conversation.owner.username} | [{self.role}] {preview}"