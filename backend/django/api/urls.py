from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'tasks', views.TaskViewSet, basename='task')
router.register(r'user-context', views.UserContextViewSet, basename='user-context')

urlpatterns = [
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    
    path('location/', views.update_location, name='update_location'),
    path('save-push-token/', views.save_push_token, name='save_push_token'),
    path('ask-ai/', views.ask_ai, name='ask-ai'),
    path('check-update/', views.check_update, name='check-update'),
    path('tasks/infer-context/', views.infer_context, name='infer-context'),
    path('tasks/<int:pk>/nearby-places/', views.nearby_places, name='task-nearby-places'),
    path('google-places/autocomplete/', views.google_places_autocomplete, name='google-places-autocomplete'),
    path('google-places/details/', views.google_place_details, name='google-place-details'),
    path('profile/settings/', views.profile_settings, name='profile-settings'),
    path('', include(router.urls)),
]