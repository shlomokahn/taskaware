from rest_framework import viewsets, status
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

PLACE_CATALOG = {
    "supermarket": {
        "label": "Supermarket",
        "tags": [("shop", "supermarket"), ("shop", "grocery"), ("shop", "convenience")],
    },
    "pharmacy": {
        "label": "Pharmacy",
        "tags": [("amenity", "pharmacy"), ("shop", "chemist")],
    },
    "post_office": {
        "label": "Post office",
        "tags": [("amenity", "post_office")],
    },
    "bank": {
        "label": "Bank",
        "tags": [("amenity", "bank")],
    },
    "atm": {
        "label": "ATM",
        "tags": [("amenity", "atm")],
    },
    "cafe": {
        "label": "Cafe",
        "tags": [("amenity", "cafe")],
    },
    "restaurant": {
        "label": "Restaurant",
        "tags": [("amenity", "restaurant"), ("amenity", "fast_food")],
    },
    "gym": {
        "label": "Gym",
        "tags": [("leisure", "fitness_centre"), ("sport", "fitness"), ("leisure", "sports_centre")],
    },
    "bakery": {
        "label": "Bakery",
        "tags": [("shop", "bakery")],
    },
    "hardware_store": {
        "label": "Hardware store",
        "tags": [("shop", "hardware")],
    },
    "electronics_store": {
        "label": "Electronics store",
        "tags": [("shop", "electronics")],
    },
    "library": {
        "label": "Library",
        "tags": [("amenity", "library")],
    },
    "print_shop": {
        "label": "Print shop",
        "tags": [("shop", "copyshop"), ("shop", "printing")],
    },
    "park": {
        "label": "Park",
        "tags": [("leisure", "park")],
    },
}

OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]


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


def resolve_place_catalog(query):
    normalized = normalize_text(query).replace(" ", "_")
    for key, config in PLACE_CATALOG.items():
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


def build_overpass_query(tags, lat, lng, radius_m):
    parts = []
    for key, value in tags:
        for element_type in ("node", "way", "relation"):
            parts.append(f'{element_type}(around:{radius_m},{lat},{lng})["{key}"="{value}"];')

    return "[out:json][timeout:25];(" + "".join(parts) + ");out center;"


def fetch_overpass_payload(query):
    last_error = None
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    headers = {"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"}

    for endpoint in OVERPASS_ENDPOINTS:
        try:
            request = urllib.request.Request(endpoint, data=data, headers=headers)
            with urllib.request.urlopen(request, timeout=25) as response:
                return json.loads(response.read().decode("utf-8"))
        except Exception as error:
            last_error = error
            continue

    raise last_error or RuntimeError("Overpass request failed")


def build_place_address(tags):
    parts = []
    street = tags.get("addr:street")
    house = tags.get("addr:housenumber")
    city = tags.get("addr:city")
    postcode = tags.get("addr:postcode")

    if street:
        street_line = street
        if house:
            street_line = f"{street_line} {house}"
        parts.append(street_line)
    if city:
        parts.append(city)
    if postcode:
        parts.append(postcode)

    return ", ".join(parts)


def build_osm_place_url(lat, lng):
    return f"https://www.openstreetmap.org/?mlat={lat}&mlon={lng}#map=18/{lat}/{lng}"


def build_directions_url(user_lat, user_lng, place_lat, place_lng):
    return (
        "https://www.google.com/maps/dir/?api=1"
        f"&origin={user_lat},{user_lng}"
        f"&destination={place_lat},{place_lng}"
        "&travelmode=walking"
    )


def build_static_map_url(center_lat, center_lng, places):
    params = [
        ("center", f"{center_lat},{center_lng}"),
        ("zoom", "15"),
        ("size", "640x360"),
        ("markers", f"{center_lat},{center_lng},blue-pushpin"),
    ]

    for place in places[:8]:
        params.append(("markers", f"{place['lat']},{place['lng']},red-pushpin"))

    return f"https://staticmap.openstreetmap.de/staticmap.php?{urllib.parse.urlencode(params, doseq=True)}"


def extract_places(payload, category_key, category_label, user_lat, user_lng):
    results = []
    seen = set()

    for element in payload.get("elements", []):
        tags = element.get("tags") or {}
        place_lat = element.get("lat")
        place_lng = element.get("lon")

        center = element.get("center") or {}
        if place_lat is None:
            place_lat = center.get("lat")
        if place_lng is None:
            place_lng = center.get("lon")

        if place_lat is None or place_lng is None:
            continue

        place_lat = float(place_lat)
        place_lng = float(place_lng)
        place_name = tags.get("name") or tags.get("brand") or category_label
        place_address = build_place_address(tags)
        place_type = tags.get("amenity") or tags.get("shop") or tags.get("leisure") or category_key
        dedupe_key = (round(place_lat, 6), round(place_lng, 6), place_name.lower())
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)

        distance_m = haversine_distance_m(user_lat, user_lng, place_lat, place_lng)
        results.append({
            "name": place_name,
            "address": place_address,
            "category": place_type,
            "lat": place_lat,
            "lng": place_lng,
            "distance_m": round(distance_m),
            "osm_url": build_osm_place_url(place_lat, place_lng),
            "directions_url": build_directions_url(user_lat, user_lng, place_lat, place_lng),
        })

    results.sort(key=lambda item: item["distance_m"])
    return results[:8]


def search_nearby_places(query, user_lat, user_lng):
    category_key, category = resolve_place_catalog(query)
    if not category_key:
        return {
            "query": query,
            "category_key": None,
            "category_label": query,
            "places": [],
            "radius_m": None,
        }

    for radius_m in (1500, 3500, 6000):
        overpass_query = build_overpass_query(category["tags"], user_lat, user_lng, radius_m)
        payload = fetch_overpass_payload(overpass_query)
        places = extract_places(payload, category_key, category["label"], user_lat, user_lng)
        if places:
            return {
                "query": query,
                "category_key": category_key,
                "category_label": category["label"],
                "places": places,
                "radius_m": radius_m,
            }

    return {
        "query": query,
        "category_key": category_key,
        "category_label": category["label"],
        "places": [],
        "radius_m": 6000,
    }


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
        place_results = search_nearby_places(location_query, user_lat, user_lng)
        places = place_results["places"]
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
        "category_key": place_results["category_key"],
        "category_label": place_results["category_label"],
        "location_source": location_source,
        "user_location": {
            "lat": user_lat,
            "lng": user_lng,
        },
        "places": places,
        "radius_m": place_results["radius_m"],
        "map_image_url": build_static_map_url(user_lat, user_lng, places) if places else build_static_map_url(user_lat, user_lng, []),
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