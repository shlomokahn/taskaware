from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Task, UserProfile, AppVersion, UserContext, UserContextVisit
from .serializers import TaskSerializer, UserSerializer, AppVersionSerializer, UserContextSerializer
import datetime
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

def check_if_user_visited_today(user, context_key):
    today = timezone.now().date()
    visit = UserContextVisit.objects.filter(user=user, context_key=context_key, date=today).first()
    return visit is not None and visit.was_visited


def parse_time_string(time_str):
    try:
        parts = time_str.split('-')
        if len(parts) == 2:
            start_str = parts[0].strip()
            end_str = parts[1].strip()
            start = datetime.datetime.strptime(start_str, "%H:%M").time()
            end = datetime.datetime.strptime(end_str, "%H:%M").time()
            return start, end
    except Exception:
        pass
    return None, None


def is_time_after_range(hours_str):
    start, end = parse_time_string(hours_str)
    if end is None:
        return True
    now_time = timezone.localtime(timezone.now()).time()
    return now_time >= end


def is_time_before_range(hours_str):
    start, end = parse_time_string(hours_str)
    if start is None:
        return True
    now_time = timezone.localtime(timezone.now()).time()
    return now_time <= start


def evaluate_conditional_notifications(user, user_lat, user_lng):
    # Update daily visits to saved contexts if user is within 200m
    contexts = UserContext.objects.filter(user=user, coords_lat__isnull=False, coords_lng__isnull=False)
    today = timezone.now().date()
    for context in contexts:
        dist = haversine_distance_m(user_lat, user_lng, float(context.coords_lat), float(context.coords_lng))
        if dist < 200:
            visit, created = UserContextVisit.objects.get_or_create(
                user=user,
                context_key=context.key,
                date=today
            )
            visit.was_visited = True
            visit.last_visited_at = timezone.now()
            visit.save()

    # Get active, unmuted tasks with required context
    pending_tasks = Task.objects.filter(
        user=user,
        is_completed=False,
        is_muted=False
    ).exclude(required_context__isnull=True).exclude(required_context='')

    for task in pending_tasks:
        context_key = task.required_context
        condition = task.context_condition
        
        user_context = UserContext.objects.filter(user=user, key=context_key).first()
        if not user_context or not user_context.coords_lat:
            continue
            
        context_lat = float(user_context.coords_lat)
        context_lng = float(user_context.coords_lng)
        
        dist_to_context = haversine_distance_m(user_lat, user_lng, context_lat, context_lng)
        is_currently_at_context = (dist_to_context < 200)
        
        context_condition_met = False
        
        if condition == 'during':
            context_condition_met = is_currently_at_context
        elif condition == 'after':
            is_outside = (dist_to_context > 300)
            visited_today = check_if_user_visited_today(user, context_key)
            
            hours_condition_met = True
            if user_context.metadata and 'hours' in user_context.metadata:
                hours_condition_met = is_time_after_range(user_context.metadata['hours'])
                
            context_condition_met = is_outside and visited_today and hours_condition_met
        elif condition == 'before':
            is_outside = (dist_to_context > 300)
            hours_condition_met = True
            if user_context.metadata and 'hours' in user_context.metadata:
                hours_condition_met = is_time_before_range(user_context.metadata['hours'])
            context_condition_met = is_outside and hours_condition_met
        else:
            context_condition_met = True

        if context_condition_met:
            if not task.locationQuery:
                continue
                
            # Anti-spam check: 1000m from last notification location
            if task.last_notified_lat is not None and task.last_notified_lng is not None:
                dist_from_last = haversine_distance_m(
                    user_lat, user_lng,
                    float(task.last_notified_lat), float(task.last_notified_lng)
                )
                if dist_from_last < 1000:
                    continue

            # API Cost Optimization: Cache results rounded to 3 decimal places (~100m)
            rounded_lat = round(user_lat, 3)
            rounded_lng = round(user_lng, 3)
            
            search_result = None
            try:
                from django.core.cache import cache
                cache_key = f"places:{rounded_lat}:{rounded_lng}:{task.locationQuery}"
                search_result = cache.get(cache_key)
                if not search_result:
                    search_result = google_places_search(task.locationQuery, user_lat, user_lng, radius_m=300)
                    cache.set(cache_key, search_result, 3600)
            except Exception as cache_err:
                print("Cache/Places error in evaluation:", str(cache_err))
                try:
                    search_result = google_places_search(task.locationQuery, user_lat, user_lng, radius_m=300)
                except Exception:
                    search_result = None

            if search_result and search_result.get("places"):
                nearest_place = search_result["places"][0]
                
                profile = UserProfile.objects.filter(user=user).first()
                if profile and profile.expo_push_token:
                    context_label = dict(UserContext.ContextKey.choices).get(context_key, context_key)
                    context_translation = {
                        'work': 'העבודה',
                        'home': 'הבית',
                        'school': 'הלימודים',
                        'gym': 'חדר הכושר'
                    }
                    context_hebrew = context_translation.get(context_key, context_label)
                    
                    body_message = f"מכיוון שסיימת ב{context_hebrew}, יש {nearest_place['name']} קרוב ({nearest_place['address']}). אל תשכח: '{task.title}'"
                    if condition == 'during':
                        body_message = f"בזמן שאתה ב{context_hebrew}, יש {nearest_place['name']} קרוב. אל תשכח: '{task.title}'"
                    elif condition == 'before':
                        body_message = f"לפני שאתה מתחיל ב{context_hebrew}, יש {nearest_place['name']} קרוב. אל תשכח: '{task.title}'"
                    
                    send_expo_push_notification(
                        expo_token=profile.expo_push_token,
                        title="📍 משימה קרובה לביצוע!",
                        body=body_message
                    )
                    
                    task.last_notified_lat = user_lat
                    task.last_notified_lng = user_lng
                    task.save(update_fields=['last_notified_lat', 'last_notified_lng'])


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
    
    try:
        evaluate_conditional_notifications(user, float(latitude), float(longitude))
    except Exception as e:
        print("Error in evaluate_conditional_notifications:", str(e))
        import traceback
        traceback.print_exc()

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

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        validated = serializer.validated_data
        context_key = validated.get('key')
        defaults = {
            'value': validated.get('value'),
            'coords_lat': validated.get('coords_lat'),
            'coords_lng': validated.get('coords_lng'),
            'metadata': validated.get('metadata'),
            'confidence': validated.get('confidence', 1.0),
            'source': validated.get('source', 'user'),
        }

        context, _ = UserContext.objects.update_or_create(
            user=request.user,
            key=context_key,
            defaults=defaults,
        )
        output = self.get_serializer(context)
        return Response(output.data, status=status.HTTP_200_OK)


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

        prompt = f"""You are a smart assistant for a task management app. The user will give you a task description in Hebrew or English.
Analyze it and return a valid JSON object ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.

Task: '{title}'

JSON Schema:
{{
  "locationQuery": "place type in English (e.g., supermarket, pharmacy, bank, post_office, cafe, gym, post_office, bakery, park, library, restaurant)",
  "requiredContext": "context key if mentioned, else null (choices: 'work', 'home', 'school', 'gym')",
  "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')"
}}

Examples:
- "לקנות חלב אחרי העבודה" -> {{"locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after"}}
- "לעשות אימון כושר" -> {{"locationQuery": "gym", "requiredContext": "gym", "contextCondition": "during"}}
- "ללמוד למבחן לפני הלימודים" -> {{"locationQuery": "library", "requiredContext": "school", "contextCondition": "before"}}
- "לקנות לחם" -> {{"locationQuery": "bakery", "requiredContext": null, "contextCondition": null}}
"""

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )

        response_text = response.text.strip()
        if response_text.startswith("```"):
            lines = response_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            response_text = "\n".join(lines).strip()

        location_query = None
        required_context = None
        context_condition = None

        try:
            parsed = json.loads(response_text)
            location_query = parsed.get("locationQuery")
            required_context = parsed.get("requiredContext")
            context_condition = parsed.get("contextCondition")
        except Exception as json_err:
            print("Failed to parse JSON from Gemini response:", response_text, str(json_err))
            location_query = response_text.replace('.', '').strip()

        # Fallback to defaults if empty
        if not location_query:
            location_query = "supermarket"

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                body_text = f"for the task '{title}', Search the area: {location_query}"
                if required_context:
                    cond_heb = {"after": "אחרי", "before": "לפני", "during": "בזמן"}.get(context_condition, "")
                    ctx_heb = {"work": "העבודה", "home": "הבית", "school": "הלימודים", "gym": "חדר הכושר"}.get(required_context, required_context)
                    body_text += f" ({cond_heb} {ctx_heb})"
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="The AI ​​has found a location! 📍",
                    body=body_message if 'body_message' in locals() else body_text
                )
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: locationQuery={location_query}, requiredContext={required_context}, contextCondition={context_condition}")
        return Response({
            "locationQuery": location_query,
            "requiredContext": required_context,
            "contextCondition": context_condition
        })

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


@api_view(['GET'])
@permission_classes([AllowAny])
def google_places_autocomplete(request):
    query = request.query_params.get('input', '').strip()
    if not query:
        return Response({'predictions': []})

    if not GOOGLE_PLACES_API_KEY:
        return Response({'error': 'Google Places API key is missing'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    params = {
        'input': query,
        'key': GOOGLE_PLACES_API_KEY,
        'language': 'he',
        'types': 'address',
    }
    url = 'https://maps.googleapis.com/maps/api/place/autocomplete/json?' + urllib.parse.urlencode(params)
    request_obj = urllib.request.Request(url)
    with urllib.request.urlopen(request_obj, timeout=20) as response:
        payload = json.loads(response.read().decode('utf-8'))

    if payload.get('status') not in ('OK', 'ZERO_RESULTS'):
        return Response({'error': payload.get('error_message') or payload.get('status')}, status=status.HTTP_502_BAD_GATEWAY)

    predictions = []
    for item in payload.get('predictions', []):
        structured = item.get('structured_formatting') or {}
        predictions.append({
            'description': item.get('description'),
            'place_id': item.get('place_id'),
            'main_text': structured.get('main_text') or item.get('description'),
            'secondary_text': structured.get('secondary_text') or '',
        })

    return Response({'predictions': predictions})


@api_view(['GET'])
@permission_classes([AllowAny])
def google_place_details(request):
    place_id = request.query_params.get('place_id', '').strip()
    if not place_id:
        return Response({'error': 'Missing place_id'}, status=status.HTTP_400_BAD_REQUEST)

    if not GOOGLE_PLACES_API_KEY:
        return Response({'error': 'Google Places API key is missing'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

    params = {
        'place_id': place_id,
        'fields': 'place_id,name,formatted_address,geometry,address_component',
        'language': 'he',
        'key': GOOGLE_PLACES_API_KEY,
    }
    url = 'https://maps.googleapis.com/maps/api/place/details/json?' + urllib.parse.urlencode(params)
    request_obj = urllib.request.Request(url)
    with urllib.request.urlopen(request_obj, timeout=20) as response:
        payload = json.loads(response.read().decode('utf-8'))

    if payload.get('status') != 'OK':
        return Response({'error': payload.get('error_message') or payload.get('status')}, status=status.HTTP_502_BAD_GATEWAY)

    result = payload.get('result') or {}
    location = (result.get('geometry') or {}).get('location') or {}
    return Response({
        'place_id': result.get('place_id') or place_id,
        'name': result.get('name'),
        'formatted_address': result.get('formatted_address'),
        'coords_lat': location.get('lat'),
        'coords_lng': location.get('lng'),
    })