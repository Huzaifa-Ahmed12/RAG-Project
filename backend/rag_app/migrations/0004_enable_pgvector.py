from django.db import migrations
from pgvector.django import VectorExtension


class Migration(migrations.Migration):

    dependencies = [
        ('rag_app', '0003_alter_conversation_owner'),  # <- your actual latest migration
    ]

    operations = [
        VectorExtension(),
    ]