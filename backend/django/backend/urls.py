from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # הפניה: כל מה שמתחיל ב-api, לך תחפש בקובץ api/urls.py
    path('api/', include('api.urls')), 
]