from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views


# יצירת ראוטר למשימות (מטפל אוטומטית ב-GET, POST, PUT, DELETE)
router = DefaultRouter()
router.register(r'tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    # נתיבי אותנטיקציה (לוגין/הרשמה)
    path('signup', views.signup, name='signup'), # בלי לוכסן בסוף, כפי שהגדרנו באפליקציה
    path('login', views.login, name='login'),    # בלי לוכסן בסוף

    # נתיב עדכון מיקום (החדש שהוספנו)
    path('location/', views.update_location, name='update_location'),

    # הכללת הנתיבים של המשימות (שנוצרו ע"י הראוטר)
    path('', include(router.urls)),
]

# api/urls.py (עדכון הקובץ הקיים)

router = DefaultRouter()
router.register(r'tasks', views.TaskViewSet, basename='task')

urlpatterns = [
    path('signup', views.signup, name='signup'),
    path('login', views.login, name='login'),
    path('location/', views.update_location, name='update_location'),
    
    # הנתיב החדש לשמירת הטוקן:
    path('save-push-token/', views.save_push_token, name='save_push_token'),

    path('', include(router.urls)),
]