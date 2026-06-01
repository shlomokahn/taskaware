from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Task, UserProfile, AppVersion, UserContext
from .serializers import TaskSerializer, UserSerializer, AppVersionSerializer, UserContextSerializer
from exponent_server_sdk import PushClient, PushMessage
from google import genai
from packaging import version as packaging_version
import json
import math
import os
import re
import urllib.parse
import urllib.request


GOOGLE_PLACES_API_KEY = (
    os.environ.get("GOOGLE_PLASE")
    or os.environ.get("GOOGLE_PLACES")
    or os.environ.get("GOOGLE_MAPS_API_KEY")
)

GOOGLE_PLACE_CATALOG = {
    "supermarket": {"label": "Supermarket", "type": "supermarket", "keyword": "supermarket"},
    "pharmacy": {"label": "Pharmacy", "type": "pharmacy", "keyword": "pharmacy"},
    "post_office": {"label": "Post office", "type": "post_office", "keyword": "post office"},
    "bank": {"label": "Bank", "type": "bank", "keyword": "bank"},
    "atm": {"label": "ATM", "type": "atm", "keyword": "atm"},
    "cafe": {"label": "Cafe", "type": "cafe", "keyword": "cafe"},
    "restaurant": {"label": "Restaurant", "type": "restaurant", "keyword": "restaurant"},
    "gym": {"label": "Gym", "type": "gym", "keyword": "gym"},
    "bakery": {"label": "Bakery", "type": "bakery", "keyword": "bakery"},
    "hardware_store": {"label": "Hardware store", "type": "hardware_store", "keyword": "hardware store"},
    "electronics_store": {"label": "Electronics store", "type": None, "keyword": "electronics store"},
    "library": {"label": "Library", "type": "library", "keyword": "library"},
    "print_shop": {"label": "Print shop", "type": None, "keyword": "print shop"},
    "park": {"label": "Park", "type": "park", "keyword": "park"},
}


TASK_PLACE_HINTS = {
    "חלב": "supermarket",
    "קניות": "supermarket",
    "מכולת": "supermarket",
    "סופר": "supermarket",
    "תרופה": "pharmacy",
    "תרופות": "pharmacy",
    "בית מרקחת": "pharmacy",
    "דואר": "post_office",
    "חבילה": "post_office",
    "אימון": "gym",
    "כושר": "gym",
    "קפה": "cafe",
    "ארוחת": "restaurant",
    "מסעדה": "restaurant",
    "כספומט": "atm",
    "כסף": "bank",
    "ספר": "library",
    "הדפס": "print_shop",
}


def send_expo_push_notification(expo_token, title, body):
    try:
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


def normalize_text(value):
    if not value:
        return ""
    return re.sub(r"[^a-z0-9\u0590-\u05ff]+", " ", str(value).lower()).strip()


def infer_task_place_query(title):
    lowered = normalize_text(title)
    for keyword, query in TASK_PLACE_HINTS.items():
        if normalize_text(keyword) in lowered:
            return query
    return None


def resolve_google_place_config(query):
    normalized = normalize_text(query).replace(" ", "_")

    for key, config in GOOGLE_PLACE_CATALOG.items():
        aliases = {key, key.replace("_", "")}
        if key == "supermarket":
            aliases.update({"grocery", "grocer", "market", "convenience"})
        elif key == "pharmacy":
            aliases.update({"chemist", "drugstore"})
        elif key == "post_office":
            aliases.update({"postoffice"})
        elif key == "hardware_store":
            aliases.update({"hardwarestore"})
        elif key == "electronics_store":
            aliases.update({"electronicsstore"})
        elif key == "print_shop":
            aliases.update({"printing", "copyshop", "print"})

        if any(alias in normalized for alias in aliases):
            return key, config

    return None, None


def haversine_distance_m(lat1, lng1, lat2, lng2):
    radius_m = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lng = math.radians(lng2 - lng1)

    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lng / 2) ** 2
    return radius_m * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


def google_places_search(query, user_lat, user_lng, radius_m):
    if not GOOGLE_PLACES_API_KEY:
        raise RuntimeError("Missing GOOGLE_PLASE environment variable")

    category_key, category = resolve_google_place_config(query)
    keyword = category["keyword"] if category else query
    place_type = category["type"] if category else None

    params = {
        "location": f"{user_lat},{user_lng}",
        "radius": str(radius_m),
        "keyword": keyword,
        "key": GOOGLE_PLACES_API_KEY,
    }
    if place_type:
        params["type"] = place_type

    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json?" + urllib.parse.urlencode(params)
    request = urllib.request.Request(url)
    with urllib.request.urlopen(request, timeout=25) as response:
        payload = json.loads(response.read().decode("utf-8"))

    if payload.get("status") not in ("OK", "ZERO_RESULTS"):
        raise RuntimeError(payload.get("error_message") or payload.get("status") or "Google Places request failed")

    results = []
    for place in payload.get("results", []):
        geometry = place.get("geometry", {}).get("location", {})
        place_lat = geometry.get("lat")
        place_lng = geometry.get("lng")
        if place_lat is None or place_lng is None:
            continue

        distance_m = haversine_distance_m(user_lat, user_lng, float(place_lat), float(place_lng))
        address = place.get("vicinity") or place.get("formatted_address") or ""

        results.append({
            "name": place.get("name") or category["label"] if category else keyword,
            "address": address,
            "category": category_key or place.get("types", [None])[0],
            "lat": float(place_lat),
            "lng": float(place_lng),
            "distance_m": round(distance_m),
            "rating": place.get("rating"),
            "user_ratings_total": place.get("user_ratings_total"),
            "place_id": place.get("place_id"),
            "maps_url": f"https://www.google.com/maps/search/?api=1&query={urllib.parse.quote_plus(place.get('name') or keyword)}&query_place_id={place.get('place_id') or ''}",
            "directions_url": (
                "https://www.google.com/maps/dir/?api=1"
                f"&origin={user_lat},{user_lng}"
                f"&destination={place_lat},{place_lng}"
                "&travelmode=walking"
            ),
        })

    results.sort(key=lambda item: item["distance_m"])
    return {
        "query": query,
        "category_key": category_key,
        "category_label": category["label"] if category else keyword,
        "places": results[:8],
        "radius_m": radius_m,
    }


def build_static_map_url(center_lat, center_lng, places):
    if not GOOGLE_PLACES_API_KEY:
        return None

    params = [
        ("center", f"{center_lat},{center_lng}"),
        ("zoom", "15"),
        ("size", "640x360"),
        ("scale", "2"),
        ("maptype", "roadmap"),
        ("markers", f"color:blue|label:U|{center_lat},{center_lng}"),
        ("key", GOOGLE_PLACES_API_KEY),
    ]

    for place in places[:8]:
        params.append(("markers", f"color:red|{place['lat']},{place['lng']}"))

    return "https://maps.googleapis.com/maps/api/staticmap?" + urllib.parse.urlencode(params, doseq=True)


def resolve_user_location(user, request_data):
    lat = request_data.get('latitude') or request_data.get('lat')
    lng = request_data.get('longitude') or request_data.get('lng')

    if lat is not None and lng is not None:
        return float(lat), float(lng), 'current_location'

    profile = UserProfile.objects.filter(user=user).first()
    if profile and profile.coords_lat is not None and profile.coords_lng is not None:
        return float(profile.coords_lat), float(profile.coords_lng), 'saved_profile_location'

    context = (
        UserContext.objects.filter(user=user, coords_lat__isnull=False, coords_lng__isnull=False)
        .order_by('-last_updated')
        .first()
    )
    if context and context.coords_lat is not None and context.coords_lng is not None:
        return float(context.coords_lat), float(context.coords_lng), 'saved_context_location'

    return None, None, None


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
    latitude = data.get('latitude')
    longitude = data.get('longitude')

    if latitude is None or longitude is None:
        return Response({'error': 'Missing latitude or longitude'}, status=status.HTTP_400_BAD_REQUEST)

    profile, _ = UserProfile.objects.get_or_create(user=user)
    profile.coords_lat = latitude
    profile.coords_lng = longitude
    profile.location_updated_at = timezone.now()
    profile.save(update_fields=['coords_lat', 'coords_lng', 'location_updated_at'])

    print(f"📍 Location updated for {user.username}: {latitude}, {longitude}")
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

    def list(self, request, *args, **kwargs):
        try:
            return super().list(request, *args, **kwargs)
        except Exception as e:
            print(f"Error in TaskViewSet.list: {str(e)}")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserContextViewSet(viewsets.ModelViewSet):
    serializer_class = UserContextSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return UserContext.objects.filter(user=self.request.user).order_by('key')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# --- AI Logic ---

ANCHOR_MAP = {
    'עבודה': UserContext.ContextKey.WORK,
    'בית': UserContext.ContextKey.HOME,
    'לימודים': UserContext.ContextKey.SCHOOL,
    'אוניברסיטה': UserContext.ContextKey.SCHOOL,
    'חדר כושר': UserContext.ContextKey.GYM,
    'work': UserContext.ContextKey.WORK,
    'home': UserContext.ContextKey.HOME,
    'school': UserContext.ContextKey.SCHOOL,
    'gym': UserContext.ContextKey.GYM,
}


def infer_context_keys(text):
    if not text:
        return set()
    lowered = text.lower()
    matched = set()
    for anchor, key in ANCHOR_MAP.items():
        if anchor in lowered:
            matched.add(key)
    return matched


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def infer_context(request):
    title = request.data.get('title', '')
    inferred_keys = infer_context_keys(title)
    if not inferred_keys:
        return Response({"pending_contexts": [], "matched_contexts": []})

    existing = set(
        UserContext.objects.filter(user=request.user, key__in=inferred_keys)
        .values_list('key', flat=True)
    )

    pending = [key for key in inferred_keys if key not in existing]
    matched = [key for key in inferred_keys if key in existing]

    label_map = {choice.value: choice.label for choice in UserContext.ContextKey}

    return Response({
        "pending_contexts": [{"key": key, "label": label_map.get(key, key)} for key in pending],
        "matched_contexts": [{"key": key, "label": label_map.get(key, key)} for key in matched],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    title = request.data.get('title')

    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

        prompt = f"""אתה עוזר חכם לאפליקציית ניהול משימות. המשתמש ייתן לך תיאור של משימה, ועליך להחזיר *אך ורק* את סוג המקום (באנגלית בלבד) שבו ניתן לבצע אותה. אל תוסיף שום הסבר.
        דוגמה: עבור 'לקנות חלב' תחזיר 'supermarket'.
        המשימה: '{title}'"""

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )

        location_query = response.text.strip().replace('.', '')

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="The AI ​​has found a location! 📍",
                    body=f"for the task '{title}', Search the area: {location_query}"
                )
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: {location_query}")
        return Response({"locationQuery": location_query})

    except Exception as e:
        print("Gemini API Error details:", str(e))
        return Response({"error": "שגיאה בפנייה למודל ה-AI"}, status=500)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def nearby_places(request, pk):
    task = get_object_or_404(Task, pk=pk, user=request.user)
    location_query = task.locationQuery or infer_task_place_query(task.title)

    if not location_query:
        return Response({
            "query": None,
            "category_key": None,
            "category_label": None,
            "location_source": None,
            "places": [],
            "map_image_url": None,
            "message": "No place category could be inferred for this task.",
        }, status=status.HTTP_200_OK)

    user_lat, user_lng, location_source = resolve_user_location(request.user, request.data)
    if user_lat is None or user_lng is None:
        return Response({
            "query": location_query,
            "category_key": None,
            "category_label": None,
            "location_source": None,
            "places": [],
            "map_image_url": None,
            "message": "No saved or current location is available. Sync your location first.",
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        search_result = None
        for radius_m in (1200, 2500, 5000):
            search_result = google_places_search(location_query, user_lat, user_lng, radius_m)
            if search_result["places"]:
                break

        places = search_result["places"] if search_result else []
        category_key = search_result["category_key"] if search_result else None
        category_label = search_result["category_label"] if search_result else location_query
        radius_m = search_result["radius_m"] if search_result else None
    except Exception as error:
        print("Nearby places error:", str(error))
        return Response({
            "query": location_query,
            "category_key": None,
            "category_label": None,
            "location_source": location_source,
            "user_location": {
                "lat": user_lat,
                "lng": user_lng,
            },
            "places": [],
            "radius_m": None,
            "map_image_url": build_static_map_url(user_lat, user_lng, []),
            "message": "Could not load nearby places right now. Please try again later.",
        }, status=status.HTTP_200_OK)

    return Response({
        "query": location_query,
        "category_key": category_key,
        "category_label": category_label,
        "location_source": location_source,
        "user_location": {
            "lat": user_lat,
            "lng": user_lng,
        },
        "places": places,
        "radius_m": radius_m,
        "map_image_url": build_static_map_url(user_lat, user_lng, places),
        "message": None if places else "No nearby places were found for this task.",
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def check_update(request):
    current_version = request.query_params.get('current_version')
    latest = AppVersion.objects.order_by('-released_at').first()

    if not latest:
        return Response({"update_available": False})

    update_available = True
    if current_version:
        try:
            update_available = packaging_version.parse(latest.version) > packaging_version.parse(current_version)
        except Exception:
            update_available = True

    return Response({
        "update_available": update_available,
        "version": latest.version,
        "release_notes": latest.release_notes,
        "is_mandatory": latest.is_mandatory,
        "download_url": latest.download_url,
    })