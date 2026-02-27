from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Task, UserProfile
from .serializers import TaskSerializer, UserSerializer
from exponent_server_sdk import PushClient, PushMessage
import google.generativeai as genai
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import os

# --- Authentication ---

@api_view(['POST'])
@permission_classes([AllowAny])
def signup(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user_id': user.id}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(username=username, password=password)
    
    if user:
        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key})
    return Response({'msg': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


# --- Helper Functions ---

def send_expo_push_notification(expo_token, title, body):
    """
    פונקציית עזר לשליחת התראת פוש דרך שרתי Expo
    """
    try:
        response = PushClient().publish(
            PushMessage(
                to=expo_token,
                title=title,
                body=body,
                sound="default"
            )
        )
        print("Push sent successfully!", response)
    except Exception as e:
        print("Failed to send push notification:", str(e))


# --- Location & Push Tokens ---

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_location(request):
    user = request.user
    data = request.data
    print(f"📍 Location update for {user.username}: {data}")
    return Response({'status': 'Location updated successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_push_token(request):
    token = request.data.get('token')
    if not token:
        return Response({"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST)
    
    # מציאת או יצירת פרופיל למשתמש ושמירת הטוקן
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    profile.expo_push_token = token
    profile.save()
    
    return Response({"message": "Token saved successfully"}, status=status.HTTP_200_OK)


# --- Tasks CRUD ---

class TaskViewSet(viewsets.ModelViewSet):
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Task.objects.filter(user=self.request.user).order_by('-created_at')

    def perform_create(self, serializer):
        # שומרים את המשימה ומשייכים למשתמש
        task = serializer.save(user=self.request.user)
        
        # --- תוספת הפוש ---
        try:
            # בודקים אם יש למשתמש פרופיל עם טוקן התראות
            profile = self.request.user.profile
            if profile.expo_push_token:
                # שולחים התראה לטלפון!
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="משימה חדשה במערכת! 🚀",
                    body=f"המשימה '{task.title}' נשמרה בהצלחה בשרת."
                )
        except Exception as e:
            # במקרה שאין למשתמש עדיין פרופיל (האפליקציה טרם שלחה), נתעלם
            print("Could not send push notification:", str(e))



# הגדרת המפתח של גוגל (שים לב להוסיף אותו לקובץ ה-.env שלך או להגדרות השרת)
# genai.configure(api_key="הכנס_את_המפתח_שלך_כאן_או_משתנה_סביבה")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

@api_view(['POST'])
@permission_classes([IsAuthenticated]) # מוודא שרק משתמש מחובר יכול לגשת
def ask_ai(request):
    title = request.data.get('title')
    
    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        # אתחול המודל
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # הפרומפט שלנו
        prompt = f"""אתה עוזר חכם לאפליקציית ניהול משימות. המשתמש ייתן לך תיאור של משימה, ועליך להחזיר *אך ורק* את סוג המקום (באנגלית או בעברית) שבו ניתן לבצע אותה, כדי שנוכל להעביר את זה לחיפוש ב-Google Maps API. אל תוסיף שום מילה נוספת, נקודה או הסבר.
        דוגמה: עבור 'לקנות חלב' תחזיר 'סופרמרקט'.
        עבור 'לקחת חבילה' תחזיר 'דואר'.
        עבור 'להוציא כסף' תחזיר 'כספומט'.
        המשימה: '{title}'"""

        # קריאה למודל
        result = model.generate_content(prompt)
        location_query = result.text.strip()
        
        # מנקה נקודה בסוף אם המודל הוסיף בטעות
        if location_query.endswith('.'):
            location_query = location_query[:-1]

        print(f"AI Answered: {location_query} for task: {title}")
        return Response({"locationQuery": location_query})

    except Exception as e:
        print("Gemini API Error:", e)
        return Response({"error": "שגיאה בפנייה למודל ה-AI"}, status=500)