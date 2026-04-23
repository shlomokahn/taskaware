from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    
    path('location/', views.update_location, name='update_location'),
    path('save-push-token/', views.save_push_token, name='save_push_token'),
    path('ask-ai/', views.ask_ai, name='ask-ai'),
    path('', include(router.urls)),
]