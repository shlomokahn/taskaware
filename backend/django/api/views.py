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
import os

# הגדרת המפתח של גוגל
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

# --- פונקציית עזר לשליחת התראות (Helper) ---

def send_expo_push_notification(expo_token, title, body):
    """
    פונקציית עזר לשליחת התראת פוש דרך שרתי Expo
    """
    try:
        # בדיקה שהטוקן תקין לפני השליחה
        if not expo_token or not expo_token.startswith("ExponentPushToken"):
            print(f"Invalid token: {expo_token}")
            return
            
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


# --- Location & Push Tokens ---

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_location(request):
    user = request.user
    data = request.data
    # כאן אפשר להוסיף לוגיקה שבודקת קרבה למשימות ושולחת פוש אם המשתמש קרוב
    print(f"📍 Location update for {user.username}: {data}")
    return Response({'status': 'Location updated successfully'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def save_push_token(request):
    token = request.data.get('token')
    if not token:
        return Response({"error": "No token provided"}, status=status.HTTP_400_BAD_REQUEST)
    
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
        task = serializer.save(user=self.request.user)
        
        # שליחת פוש בעת יצירת משימה
        try:
            profile = UserProfile.objects.get(user=self.request.user)
            if profile.expo_push_token:
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="משימה חדשה נשמרה 📝",
                    body=f"המשימה '{task.title}' התווספה לרשימה שלך."
                )
        except Exception as e:
            print("Could not send push notification on create:", str(e))


# --- AI Logic ---

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    title = request.data.get('title')
    
    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        # שימוש במודל עדכני (1.5-flash הוא מהיר וחינמי)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""אתה עוזר חכם לאפליקציית ניהול משימות. המשתמש ייתן לך תיאור של משימה, ועליך להחזיר *אך ורק* את סוג המקום (באנגלית או בעברית) שבו ניתן לבצע אותה. אל תוסיף שום הסבר.
        דוגמה: עבור 'לקנות חלב' תחזיר 'סופרמרקט'.
        המשימה: '{title}'"""

        result = model.generate_content(prompt)
        location_query = result.text.strip().replace('.', '')

        # --- הוספת שליחת פוש כשה-AI מסיים לנתח ---
        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="ה-AI ניתח את המשימה! ✨",
                    body=f"עבור '{title}', כדאי לך לחפש ב: {location_query}"
                )
        except:
            pass # אם אין טוקן, פשוט נמשיך בלי לשלוח פוש

        print(f"AI Answered: {location_query}")
        return Response({"locationQuery": location_query})

    except Exception as e:
        print("Gemini API Error:", e)
        return Response({"error": f"שגיאה בפנייה למודל ה-AI: {str(e)}"}, status=500)