from django.urls import path
from . import views, auth_views

urlpatterns = [
     path("auth/register/", auth_views.register),
    path("auth/login/", auth_views.login),
    path("auth/me/", auth_views.me),
    
    path("upload/", views.upload_pdf),
    path("documents/", views.list_documents),
    path("documents/<str:doc_id>/", views.delete_document),
    path("chat/", views.chat),
    path("conversations/", views.get_conversations),
    path("conversations/<int:conversation_id>/messages/", views.get_conversation_messages),
    path("conversations/<int:conversation_id>/", views.delete_conversation),

]