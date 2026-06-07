from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from .models import Task, UserProfile, AppVersion, UserContext, UserContextVisit
from .serializers import TaskSerializer, UserSerializer, AppVersionSerializer, UserContextSerializer, UserProfileSerializer
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
    # supermarket
    "חלב": "supermarket",
    "גבינה": "supermarket",
    "קוטג'": "supermarket",
    "שמפו": "supermarket",
    "סבון": "supermarket",
    "ביצים": "supermarket",
    "לחם": "supermarket",
    "קניות": "supermarket",
    "מכולת": "supermarket",
    "סופר": "supermarket",
    "סופרמרקט": "supermarket",
    "ירקות": "supermarket",
    "פירות": "supermarket",
    "בשר": "supermarket",
    "עוף": "supermarket",
    "אוכל": "supermarket",
    "מעדניה": "supermarket",
    "מעדנייה": "supermarket",
    "קורנפלקס": "supermarket",
    "חטיף": "supermarket",
    "חטיפים": "supermarket",
    "שוקולד": "supermarket",
    
    # pharmacy
    "תרופה": "pharmacy",
    "תרופות": "pharmacy",
    "בית מרקחת": "pharmacy",
    "בית-מרקחת": "pharmacy",
    "פארם": "pharmacy",
    "סופרפארם": "pharmacy",
    "סופר-פארם": "pharmacy",
    "מרשם": "pharmacy",
    "אקמול": "pharmacy",
    "אדוויל": "pharmacy",
    "נוירופן": "pharmacy",
    "חבישה": "pharmacy",
    "אספירין": "pharmacy",
    "פלסטר": "pharmacy",
    "ויטמינים": "pharmacy",
    
    # post_office
    "דואר": "post_office",
    "חבילה": "post_office",
    "מכתב": "post_office",
    "בולים": "post_office",
    "משלוח": "post_office",
    "דואר ישראל": "post_office",
    "מכתבים": "post_office",
    "חבילות": "post_office",
    
    # gym
    "אימון": "gym",
    "כושר": "gym",
    "חדר כושר": "gym",
    "חדר-כושר": "gym",
    "ספורט": "gym",
    "ריצה": "gym",
    "הליכון": "gym",
    "משקולות": "gym",
    "סטודיו": "gym",
    
    # cafe
    "קפה": "cafe",
    "ארומה": "cafe",
    "קפאין": "cafe",
    "אספרסו": "cafe",
    "הפוך": "cafe",
    "מאפה": "cafe",
    "נספרסו": "cafe",
    "קפוצ'ינו": "cafe",
    
    # restaurant
    "ארוחת": "restaurant",
    "מסעדה": "restaurant",
    "פיצה": "restaurant",
    "המבורגר": "restaurant",
    "סושי": "restaurant",
    "לאנץ'": "restaurant",
    "דינר": "restaurant",
    "סטייק": "restaurant",
    "פאב": "restaurant",
    "בר": "restaurant",
    "שווארמה": "restaurant",
    "פלאפל": "restaurant",
    
    # atm
    "כספומט": "atm",
    "משוך": "atm",
    "למשוך": "atm",
    "כסף מזומן": "atm",
    "מזומן": "atm",
    "atm": "atm",
    
    # bank
    "בנק": "bank",
    "הפקד": "bank",
    "להפקיד": "bank",
    "צ'ק": "bank",
    "משכנתא": "bank",
    "חשבון": "bank",
    "פועלים": "bank",
    "לאומי": "bank",
    "דיסקונט": "bank",
    "מזרחי": "bank",
    "סניף בנק": "bank",
    
    # bakery
    "מאפייה": "bakery",
    "מאפיה": "bakery",
    "לחמניה": "bakery",
    "חלה": "bakery",
    "עוגה": "bakery",
    "עוגיות": "bakery",
    "בורקס": "bakery",
    "קרואסון": "bakery",
    "פיתות": "bakery",
    
    # hardware_store
    "טמבור": "hardware_store",
    "מפתח": "hardware_store",
    "שכפל": "hardware_store",
    "לשכפל": "hardware_store",
    "ברגים": "hardware_store",
    "כלי עבודה": "hardware_store",
    "פטיש": "hardware_store",
    "צבע": "hardware_store",
    "מברג": "hardware_store",
    "מנורה": "hardware_store",
    
    # electronics_store
    "כבל": "electronics_store",
    "מטען": "electronics_store",
    "טלפון": "electronics_store",
    "מחשב": "electronics_store",
    "אזניות": "electronics_store",
    "סוללה": "electronics_store",
    "סוללות": "electronics_store",
    "אוזניות": "electronics_store",
    "מטען לטלפון": "electronics_store",
    
    # library
    "ספרייה": "library",
    "ספריה": "library",
    "ספר": "library",
    "ללמוד": "library",
    "שקט": "library",
    
    # print_shop
    "הדפס": "print_shop",
    "להדפיס": "print_shop",
    "צילום": "print_shop",
    "לצלם": "print_shop",
    "סורק": "print_shop",
    "לסרוק": "print_shop",
    
    # park
    "פארק": "park",
    "גינה": "park",
    "דשא": "park",
    "טיול": "park",
    "גינת": "park",
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


VALID_HEBREW_PREFIXES = {
    # Single
    "ב", "ה", "ו", "ל", "מ", "ש", "כ",
    # Double
    "וה", "וב", "ול", "ומ", "וש", "וכ",
    "שה", "שב", "של", "שמ", "שכ",
    # Triple
    "וכש", "שכש"
}


def infer_task_place_query(title):
    lowered = normalize_text(title)
    words = lowered.split()
    
    # Sort keywords by length descending so longer phrases match first (e.g. "דואר ישראל" before "דואר")
    sorted_keywords = sorted(TASK_PLACE_HINTS.keys(), key=len, reverse=True)
    
    for word in words:
        for keyword in sorted_keywords:
            kw_norm = normalize_text(keyword)
            # 1. Exact match
            if word == kw_norm:
                return TASK_PLACE_HINTS[keyword]
            # 2. Hebrew prefix support with valid prefixes list
            if len(word) > len(kw_norm):
                prefix = word[:-len(kw_norm)]
                suffix = word[-len(kw_norm):]
                if suffix == kw_norm and prefix in VALID_HEBREW_PREFIXES:
                    return TASK_PLACE_HINTS[keyword]
                    
    # Fallback to phrase-in-sentence check for multi-word keywords (like "דואר ישראל" or "בית מרקחת")
    for keyword in sorted_keywords:
        if " " in keyword:
            kw_norm = normalize_text(keyword)
            if kw_norm in lowered:
                return TASK_PLACE_HINTS[keyword]
                
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
    profile, _ = UserProfile.objects.get_or_create(user=user)
    if not profile.notifications_enabled:
        print(f"Notifications disabled for {user.username}")
        return

    # Check Do Not Disturb (DND)
    if profile.dnd_enabled and profile.dnd_start and profile.dnd_end:
        try:
            dnd_start_time = datetime.datetime.strptime(profile.dnd_start, "%H:%M").time()
            dnd_end_time = datetime.datetime.strptime(profile.dnd_end, "%H:%M").time()
            now_time = timezone.localtime(timezone.now()).time()
            
            in_dnd = False
            if dnd_start_time <= dnd_end_time:
                in_dnd = dnd_start_time <= now_time <= dnd_end_time
            else: # Overnight
                in_dnd = now_time >= dnd_start_time or now_time <= dnd_end_time
                
            if in_dnd:
                print(f"Skipping notification due to DND: {now_time}")
                return
        except Exception as dnd_err:
            print("Error evaluating DND settings:", str(dnd_err))

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

    # Get active, unmuted tasks with either a required context OR a location query
    from django.db.models import Q
    pending_tasks = Task.objects.filter(
        user=user,
        is_completed=False,
        is_muted=False
    ).filter(
        Q(required_context__isnull=False) & ~Q(required_context='') |
        Q(locationQuery__isnull=False) & ~Q(locationQuery='')
    )

    satisfied_tasks = []
    for task in pending_tasks:
        context_key = task.required_context
        condition = task.context_condition
        
        # Check if context is muted in user preferences
        if context_key and profile.muted_contexts and context_key in profile.muted_contexts:
            continue
            
        context_condition_met = False
        
        if context_key:
            user_context = UserContext.objects.filter(user=user, key=context_key).first()
            if not user_context or not user_context.coords_lat:
                continue
                
            context_lat = float(user_context.coords_lat)
            context_lng = float(user_context.coords_lng)
            
            dist_to_context = haversine_distance_m(user_lat, user_lng, context_lat, context_lng)
            is_currently_at_context = (dist_to_context < 200)
            
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
        else:
            # No anchor context, so the condition is always met (we just care about proximity to locationQuery)
            context_condition_met = True

        if context_condition_met and task.locationQuery:
            satisfied_tasks.append(task)

    # Group satisfied tasks by locationQuery (case-insensitive, trimmed)
    grouped_tasks = {}
    for task in satisfied_tasks:
        query_key = task.locationQuery.strip().lower()
        if query_key not in grouped_tasks:
            grouped_tasks[query_key] = []
        grouped_tasks[query_key].append(task)

    for query_key, task_list in grouped_tasks.items():
        # Anti-spam filter: Filter out individual tasks notified within 1000m recently
        notify_list = []
        for task in task_list:
            if task.last_notified_lat is not None and task.last_notified_lng is not None:
                dist_from_last = haversine_distance_m(
                    user_lat, user_lng,
                    float(task.last_notified_lat), float(task.last_notified_lng)
                )
                if dist_from_last < 1000:
                    continue
            notify_list.append(task)

        if not notify_list:
            continue

        # Check if the user has a saved context preference for this query_key
        user_context_pref = UserContext.objects.filter(
            user=user, 
            key=query_key, 
            coords_lat__isnull=False, 
            coords_lng__isnull=False
        ).first()

        nearest_place = None
        if user_context_pref:
            pref_lat = float(user_context_pref.coords_lat)
            pref_lng = float(user_context_pref.coords_lng)
            dist_to_pref = haversine_distance_m(user_lat, user_lng, pref_lat, pref_lng)
            radius_m = profile.notification_radius or 300
            
            if dist_to_pref <= radius_m:
                val_parts = user_context_pref.value.split(',', 1)
                name = val_parts[0].strip()
                address = val_parts[1].strip() if len(val_parts) > 1 else user_context_pref.value
                nearest_place = {
                    "name": name,
                    "address": address,
                    "lat": pref_lat,
                    "lng": pref_lng,
                    "distance_m": round(dist_to_pref)
                }
        else:
            # Fallback to dynamic Google Places search around their current location
            original_query = notify_list[0].locationQuery
            radius_m = profile.notification_radius or 300
            rounded_lat = round(user_lat, 3)
            rounded_lng = round(user_lng, 3)
            
            search_result = None
            try:
                from django.core.cache import cache
                cache_key = f"places:{rounded_lat}:{rounded_lng}:{query_key}:{radius_m}"
                search_result = cache.get(cache_key)
                if not search_result:
                    search_result = google_places_search(original_query, user_lat, user_lng, radius_m=radius_m)
                    cache.set(cache_key, search_result, 3600)
            except Exception as cache_err:
                print("Cache/Places error in evaluation:", str(cache_err))
                try:
                    search_result = google_places_search(original_query, user_lat, user_lng, radius_m=radius_m)
                except Exception:
                    search_result = None
            
            if search_result and search_result.get("places"):
                nearest_place = search_result["places"][0]

        if nearest_place:
            alert_sent = False
            
            if profile.expo_push_token:
                if len(notify_list) == 1:
                    # Single task notification
                    task = notify_list[0]
                    if task.required_context:
                        context_label = dict(UserContext.ContextKey.choices).get(task.required_context, task.required_context)
                        context_name = context_label.lower() if context_label else "location"
                        
                        body_message = f"Since you finished at {context_name}, there is a {nearest_place['name']} nearby ({nearest_place['address']}). Don't forget: '{task.title}'"
                        if task.context_condition == 'during':
                            body_message = f"While you are at {context_name}, there is a {nearest_place['name']} nearby. Don't forget: '{task.title}'"
                        elif task.context_condition == 'before':
                            body_message = f"Before you start at {context_name}, there is a {nearest_place['name']} nearby. Don't forget: '{task.title}'"
                    else:
                        # No anchor context (straight location proximity)
                        body_message = f"You are near {nearest_place['name']} ({nearest_place['address']}). Don't forget: '{task.title}'"
                    
                    title_message = "📍 Task location nearby!"
                else:
                    # Multiple tasks notification
                    titles_str = ", ".join([f"'{t.title}'" for t in notify_list])
                    body_message = f"You have {len(notify_list)} tasks near {nearest_place['name']} ({nearest_place['address']}): {titles_str}"
                    title_message = f"📍 {nearest_place['name']}: {len(notify_list)} Tasks"
                
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title=title_message,
                    body=body_message
                )
                alert_sent = True
                
            #         context_name = context_label.lower() if context_label else "location"
            #         
            #         tg_text = f"📍 <b>Task location nearby!</b>\n\n"
            #         if task.context_condition == 'during':
            #             tg_text += f"While you are at {context_name}, there is a <b>{nearest_place['name']}</b> nearby ({nearest_place['address']}).\n"
            #         elif task.context_condition == 'before':
            #             tg_text += f"Before you start at {context_name}, there is a <b>{nearest_place['name']}</b> nearby ({nearest_place['address']}).\n"
            #         else:
            #             tg_text += f"Since you finished at {context_name}, there is a <b>{nearest_place['name']}</b> nearby ({nearest_place['address']}).\n"
            #         tg_text += f"\nDon't forget: <b>{task.title}</b>"
            #         
            #         reply_markup = {
            #             "inline_keyboard": [
            #                 [
            #                     {"text": "✓ Complete", "callback_data": f"complete_{task.id}"},
            #                     {"text": "🔕 Mute", "callback_data": f"mute_{task.id}"}
            #                 ]
            #             ]
            #         }
            #         send_telegram_message(profile.telegram_chat_id, tg_text, reply_markup=reply_markup)
            #     else:
            #         tg_text = f"📍 <b>{nearest_place['name']}</b> nearby ({nearest_place['address']})\n"
            #         tg_text += f"You have <b>{len(notify_list)} tasks</b> nearby:\n\n"
            #         
            #         inline_keyboard = []
            #         for t in notify_list:
            #             tg_text += f"• <b>{t.title}</b>\n"
            #             inline_keyboard.append([
            #                 {"text": f"✓ Complete: {t.title[:15]}...", "callback_data": f"complete_{t.id}"},
            #                 {"text": f"🔕 Mute: {t.title[:15]}...", "callback_data": f"mute_{t.id}"}
            #             ])
            #         
            #         reply_markup = {"inline_keyboard": inline_keyboard}
            #         send_telegram_message(profile.telegram_chat_id, tg_text, reply_markup=reply_markup)
            #     alert_sent = True
            #     
            # if profile.whatsapp_number:
            #     if len(notify_list) == 1:
            #         task = notify_list[0]
            #         context_label = dict(UserContext.ContextKey.choices).get(task.required_context, task.required_context)
            #         context_name = context_label.lower() if context_label else "location"
            #         
            #         wa_text = f"📍 *Task location nearby!*\n\n"
            #         if task.context_condition == 'during':
            #             wa_text += f"While you are at {context_name}, there is a *{nearest_place['name']}* nearby ({nearest_place['address']}).\n"
            #         elif task.context_condition == 'before':
            #             wa_text += f"Before you start at {context_name}, there is a *{nearest_place['name']}* nearby ({nearest_place['address']}).\n"
            #         else:
            #             wa_text += f"Since you finished at {context_name}, there is a *{nearest_place['name']}* nearby ({nearest_place['address']}).\n"
            #         wa_text += f"\nDon't forget: *{task.title}*\n\n"
            #         wa_text += f"👉 Reply *complete {task.id}* to mark completed, or *mute {task.id}* to mute alerts."
            #         send_whatsapp_message(profile.whatsapp_number, wa_text)
            #     else:
            #         wa_text = f"📍 *{nearest_place['name']}* nearby ({nearest_place['address']})\n"
            #         wa_text += f"You have *{len(notify_list)} tasks* nearby:\n\n"
            #         
            #         for t in notify_list:
            #             wa_text += f"• *{t.title}* (ID: {t.id})\n"
            #             
            #         wa_text += f"\n👉 Reply *complete <id>* or *mute <id>* to perform actions."
            #         send_whatsapp_message(profile.whatsapp_number, wa_text)
            #     alert_sent = True
                
            if alert_sent:
                # Update last notified positions
                for task in notify_list:
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


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_settings(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if request.method == 'GET':
        serializer = UserProfileSerializer(profile)
        return Response(serializer.data)
    elif request.method == 'PATCH':
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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

    @action(detail=False, methods=['POST'], url_path='create-from-voice')
    def create_from_voice(self, request):
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': 'No audio file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            audio_bytes = file_obj.read()
            mime_type = file_obj.content_type or 'audio/mp4'
            device_time = request.data.get('deviceTime')
            
            ai_data = parse_voice_message_with_ai(audio_bytes, mime_type=mime_type, device_time=device_time, user=request.user)
            if not ai_data or not ai_data.get('title'):
                return Response({'error': 'AI failed to parse the voice recording'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                
            serializer_data = {
                'title': ai_data.get('title'),
                'dueDate': ai_data.get('dueDate'),
                'locationQuery': ai_data.get('locationQuery'),
                'requiredContext': ai_data.get('requiredContext'),
                'contextCondition': ai_data.get('contextCondition'),
            }
            serializer = self.get_serializer(data=serializer_data)
            serializer.is_valid(raise_exception=True)
            task = serializer.save(user=request.user)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            print("Error in create_from_voice:", str(e))
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


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


def get_user_context_choices(user):
    if not user or not user.is_authenticated:
        return ["work", "home", "school", "gym"]
    
    saved_keys = list(
        UserContext.objects.filter(user=user)
        .values_list('key', flat=True)
    )
    
    core_keys = ["work", "home", "school", "gym"]
    for k in core_keys:
        if k not in saved_keys:
            saved_keys.append(k)
            
    return saved_keys


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
    
    # Also find locationQuery from task or infer it
    location_query = None
    # 1. Try to find recently created task with this title
    recent_task = Task.objects.filter(user=request.user, title=title).order_by('-created_at').first()
    if recent_task and recent_task.locationQuery:
        location_query = recent_task.locationQuery
    else:
        location_query = infer_task_place_query(title)
        
    # If a locationQuery was found, add it to inferred keys
    if location_query:
        category_key, config = resolve_google_place_config(location_query)
        target_key = category_key if category_key else location_query.lower().strip()
        inferred_keys.add(target_key)
        
    if not inferred_keys:
        return Response({"pending_contexts": [], "matched_contexts": []})

    existing = set(
        UserContext.objects.filter(user=request.user, key__in=inferred_keys)
        .values_list('key', flat=True)
    )

    pending = [key for key in inferred_keys if key not in existing]
    matched = [key for key in inferred_keys if key in existing]

    # Helper to get label
    def get_label(key):
        # 1. Check ContextKey choices
        for val, label in UserContext.ContextKey.choices:
            if val == key:
                return label
        # 2. Check GOOGLE_PLACE_CATALOG
        if key in GOOGLE_PLACE_CATALOG:
            return GOOGLE_PLACE_CATALOG[key]["label"]
        # 3. Fallback: format key nicely
        return key.replace('_', ' ').title()

    return Response({
        "pending_contexts": [{"key": key, "label": get_label(key)} for key in pending],
        "matched_contexts": [{"key": key, "label": get_label(key)} for key in matched],
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ask_ai(request):
    title = request.data.get('title')
    device_time = request.data.get('deviceTime')

    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        current_time_str = device_time if device_time else timezone.now().isoformat()
        choices = get_user_context_choices(request.user)
        choices_str = ", ".join([f"'{c}'" for c in choices])

        prompt = f"""You are a smart assistant for a task management app. The user will give you a task description in Hebrew or English.
Analyze it and return a valid JSON object ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.

Task: '{title}'

JSON Schema:
{{
  "locationQuery": "place type in English. Map tasks semantically to one of these category keys if they are related:
   - 'supermarket': for groceries, shopping, food, milk, cheese, cottage, eggs, vegetables, fruits, bread, shampoo, soap, grocery items
   - 'pharmacy': for medications, pharmacy, pills, drugs, prescription, acamol, advil
   - 'post_office': for packages, mail, letters, stamps, post office
   - 'bank': for bank, depositing checks, loans
   - 'atm': for cash, withdraw, ATM
   - 'cafe': for coffee, cafe, espresso
   - 'restaurant': for dinner, lunch, restaurant, meals, food menu, pizza, sushi, hamburger
   - 'gym': for workout, training, fitness, gym, exercise
   - 'bakery': for bread, cake, bakery, croissant, challah, pita
   - 'hardware_store': for tools, screws, keys, replica keys, hammer, hardware store, repair
   - 'electronics_store': for cables, charger, phone charger, electronics, computer repair, USB cable, headphones
   - 'library': for books, study, library
   - 'print_shop': for printing, copying, scanning
   - 'park': for park, running, nature
   Or null if the task is not related to a physical place category. Be extremely smart and classify specific products/items to their corresponding category, even if the category name itself is not mentioned.",
  "requiredContext": "context key if mentioned, else null (choices: {choices_str})",
  "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')",
  "dueDate": "ISO 8601 date time string if date/time is mentioned relative to current time, else null"
}}

Current Time Context: {current_time_str}

Examples:
- "לקנות חלב וגבינה אחרי העבודה" -> {{"locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after", "dueDate": null}}
- "לקנות אקמול" -> {{"locationQuery": "pharmacy", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לשכפל מפתח" -> {{"locationQuery": "hardware_store", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "ללמוד למבחן בספרייה לפני הלימודים" -> {{"locationQuery": "library", "requiredContext": "school", "contextCondition": "before", "dueDate": null}}
- "למשוך כסף" -> {{"locationQuery": "atm", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "להפקיד צ'ק בבנק" -> {{"locationQuery": "bank", "requiredContext": "bank", "contextCondition": "during", "dueDate": null}}
- "לקנות קוטג' וקשקבל מחר בבוקר" -> {{"locationQuery": "supermarket", "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T08:00:00"}}
- "לקנות שמפו לשיער וסבון כלים" -> {{"locationQuery": "supermarket", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לקנות כבל מטען לטלפון" -> {{"locationQuery": "electronics_store", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לקנות קרואסון חם" -> {{"locationQuery": "bakery", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לשלוח מכתב בדואר" -> {{"locationQuery": "post_office", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לחייג לאמא מחר ב10 בבוקר" -> {{"locationQuery": null, "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T10:00:00"}}
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

        due_date_str = None
        try:
            parsed = json.loads(response_text)
            location_query = parsed.get("locationQuery")
            required_context = parsed.get("requiredContext")
            context_condition = parsed.get("contextCondition")
            due_date_str = parsed.get("dueDate")
        except Exception as json_err:
            print("Failed to parse JSON from Gemini response:", response_text, str(json_err))
            location_query = response_text.replace('.', '').strip()

        # Fallback to defaults if empty
        if not location_query and not required_context and not due_date_str:
            location_query = "supermarket"

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token and location_query:
                body_text = f"for the task '{title}', Search the area: {location_query}"
                if required_context:
                    cond_heb = {"after": "אחרי", "before": "לפני", "during": "בזמן"}.get(context_condition, "")
                    ctx_heb = {"work": "העבודה", "home": "הבית", "school": "הלימודים", "gym": "חדר הכושר"}.get(required_context, required_context)
                    body_text += f" ({cond_heb} {ctx_heb})"
                send_expo_push_notification(
                    expo_token=profile.expo_push_token,
                    title="The AI ​​has found a location! 📍",
                    body=body_text
                )
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: locationQuery={location_query}, requiredContext={required_context}, contextCondition={context_condition}, dueDate={due_date_str}")
        return Response({
            "locationQuery": location_query,
            "requiredContext": required_context,
            "contextCondition": context_condition,
            "dueDate": due_date_str
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


# --- Telegram Bot Helper & Views ---

def send_telegram_message(chat_id, text, reply_markup=None):
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8453640532:AAErBXFHaIrZnpN_oi7H0gd1NJUXEkhriyo"
    if not token:
        print("TELEGRAM_BOT_TOKEN is not configured")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if not res_data.get("ok"):
                print("Telegram API returned error:", res_data)
    except Exception as e:
        print("Failed to send telegram message:", str(e))


def edit_telegram_message(chat_id, message_id, text, reply_markup=None):
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8453640532:AAErBXFHaIrZnpN_oi7H0gd1NJUXEkhriyo"
    if not token:
        print("TELEGRAM_BOT_TOKEN is not configured")
        return
    url = f"https://api.telegram.org/bot{token}/editMessageText"
    payload = {
        "chat_id": chat_id,
        "message_id": message_id,
        "text": text,
        "parse_mode": "HTML"
    }
    if reply_markup is not None:
        payload["reply_markup"] = reply_markup
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if not res_data.get("ok"):
                print("Telegram editMessageText returned error:", res_data)
    except Exception as e:
        print("Failed to edit telegram message:", str(e))


def answer_telegram_callback(callback_id, text=None):
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8453640532:AAErBXFHaIrZnpN_oi7H0gd1NJUXEkhriyo"
    if not token:
        print("TELEGRAM_BOT_TOKEN is not configured")
        return
    url = f"https://api.telegram.org/bot{token}/answerCallbackQuery"
    payload = {
        "callback_query_id": callback_id,
    }
    if text:
        payload["text"] = text
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if not res_data.get("ok"):
                print("Telegram answerCallbackQuery returned error:", res_data)
    except Exception as e:
        print("Failed to answer callback query:", str(e))


def download_telegram_file(file_id):
    token = os.environ.get("TELEGRAM_BOT_TOKEN") or "8453640532:AAErBXFHaIrZnpN_oi7H0gd1NJUXEkhriyo"
    if not token:
        print("TELEGRAM_BOT_TOKEN is not configured")
        return None
    
    url = f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}"
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=15) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if not res_data.get("ok"):
                print("Telegram getFile returned error:", res_data)
                return None
            file_path = res_data["result"]["file_path"]
            
        download_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
        download_req = urllib.request.Request(download_url)
        with urllib.request.urlopen(download_req, timeout=25) as download_res:
            return download_res.read()
    except Exception as e:
        print("Failed to download telegram file:", str(e))
        return None


def parse_voice_message_with_ai(audio_bytes, mime_type='audio/ogg', device_time=None, user=None):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None

    try:
        from google import genai
        from google.genai import types
        
        choices = get_user_context_choices(user)
        choices_str = ", ".join([f"'{c}'" for c in choices])
        current_time_str = device_time if device_time else timezone.now().isoformat()

        prompt = f"""You are a smart assistant for a task management app.
The user has provided a voice message (audio) in Hebrew or English.
First, transcribe the voice message accurately.
Second, analyze the transcription to extract structured task information.
Return a valid JSON object ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.

JSON Schema:
{{
  "title": "the task description / transcription in its original language (Hebrew or English) - clean, concise task title",
  "locationQuery": "place type in English. Map tasks semantically to one of these category keys if they are related:
   - 'supermarket': for groceries, shopping, food, milk, cheese, cottage, eggs, vegetables, fruits, bread, shampoo, soap, grocery items
   - 'pharmacy': for medications, pharmacy, pills, drugs, prescription, acamol, advil
   - 'post_office': for packages, mail, letters, stamps, post office
   - 'bank': for bank, depositing checks, loans
   - 'atm': for cash, withdraw, ATM
   - 'cafe': for coffee, cafe, espresso
   - 'restaurant': for dinner, lunch, restaurant, meals, food menu, pizza, sushi, hamburger
   - 'gym': for workout, training, fitness, gym, exercise
   - 'bakery': for bread, cake, bakery, croissant, challah, pita
   - 'hardware_store': for tools, screws, keys, replica keys, hammer, hardware store, repair
   - 'electronics_store': for cables, charger, phone charger, electronics, computer repair, USB cable, headphones
   - 'library': for books, study, library
   - 'print_shop': for printing, copying, scanning
   - 'park': for park, running, nature
   Or null if the task is not related to a physical place category. Be extremely smart and classify specific products/items to their corresponding category, even if the category name itself is not mentioned.",
  "requiredContext": "context key if mentioned, else null (choices: {choices_str})",
  "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')",
  "dueDate": "ISO 8601 date time string if date/time is mentioned relative to current time, else null"
}}

Current Time Context: {current_time_str}

Examples:
- Audio saying "לקנות חלב אחרי העבודה" -> {{"title": "לקנות חלב אחרי העבודה", "locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after", "dueDate": null}}
- Audio saying "לקנות אקמול" -> {{"title": "לקנות אקמול", "locationQuery": "pharmacy", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- Audio saying "לעשות אימון כושר מחר בבוקר" -> {{"title": "לעשות אימון כושר מחר בבוקר", "locationQuery": "gym", "requiredContext": "gym", "contextCondition": "during", "dueDate": "2026-06-07T08:00:00"}}
- Audio saying "לקנות קרואסון חם מאפייה" -> {{"title": "לקנות קרואסון חם מאפייה", "locationQuery": "bakery", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- Audio saying "לקנות קוטג' וקשקבל" -> {{"title": "לקנות קוטג' וקשקבל", "locationQuery": "supermarket", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- Audio saying "לקנות כבל מטען לטלפון" -> {{"title": "לקנות כבל מטען לטלפון", "locationQuery": "electronics_store", "requiredContext": null, "contextCondition": null, "dueDate": null}}
"""

        audio_part = types.Part.from_bytes(
            data=audio_bytes,
            mime_type=mime_type,
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[audio_part, prompt],
        )
        
        response_text = response.text.strip()
        if response_text.startswith("```"):
            lines = response_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            response_text = "\n".join(lines).strip()
            
        parsed = json.loads(response_text)
        return parsed
    except Exception as e:
        print("Error in parse_voice_message_with_ai:", str(e))
        return None


def fetch_ai_details_for_telegram(title, user):
    location_query = None
    required_context = None
    context_condition = None
    due_date = None

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return {"locationQuery": None, "requiredContext": None, "contextCondition": None, "dueDate": None}

    try:
        from google import genai
        client = genai.Client(api_key=gemini_key)
        
        choices = get_user_context_choices(user)
        choices_str = ", ".join([f"'{c}'" for c in choices])

        prompt = f"""You are a smart assistant for a task management app. The user will give you a task description in Hebrew or English.
Analyze it and return a valid JSON object ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.

Task: '{title}'

JSON Schema:
{{
  "locationQuery": "place type in English. Map tasks semantically to one of these category keys if they are related:
   - 'supermarket': for groceries, shopping, food, milk, cheese, cottage, eggs, vegetables, fruits, bread, shampoo, soap, grocery items
   - 'pharmacy': for medications, pharmacy, pills, drugs, prescription, acamol, advil
   - 'post_office': for packages, mail, letters, stamps, post office
   - 'bank': for bank, depositing checks, loans
   - 'atm': for cash, withdraw, ATM
   - 'cafe': for coffee, cafe, espresso
   - 'restaurant': for dinner, lunch, restaurant, meals, food menu, pizza, sushi, hamburger
   - 'gym': for workout, training, fitness, gym, exercise
   - 'bakery': for bread, cake, bakery, croissant, challah, pita
   - 'hardware_store': for tools, screws, keys, replica keys, hammer, hardware store, repair
   - 'electronics_store': for cables, charger, phone charger, electronics, computer repair, USB cable, headphones
   - 'library': for books, study, library
   - 'print_shop': for printing, copying, scanning
   - 'park': for park, running, nature
   Or null if the task is not related to a physical place category. Be extremely smart and classify specific products/items to their corresponding category, even if the category name itself is not mentioned.",
  "requiredContext": "context key if mentioned, else null (choices: {choices_str})",
  "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')",
  "dueDate": "ISO 8601 date time string if date/time is mentioned relative to current time, else null"
}}

Current Time Context: {timezone.now().isoformat()}

Examples:
- "לקנות חלב וגבינה אחרי העבודה" -> {{"locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after", "dueDate": null}}
- "לקנות אקמול" -> {{"locationQuery": "pharmacy", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לשכפל מפתח" -> {{"locationQuery": "hardware_store", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "ללמוד למבחן בספרייה לפני הלימודים" -> {{"locationQuery": "library", "requiredContext": "school", "contextCondition": "before", "dueDate": null}}
- "למשוך כסף" -> {{"locationQuery": "atm", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "להפקיד צ'ק בבנק" -> {{"locationQuery": "bank", "requiredContext": "bank", "contextCondition": "during", "dueDate": null}}
- "לקנות קוטג' וקשקבל מחר בבוקר" -> {{"locationQuery": "supermarket", "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T08:00:00"}}
- "לקנות שמפו לשיער וסבון כלים" -> {{"locationQuery": "supermarket", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לקנות כבל מטען לטלפון" -> {{"locationQuery": "electronics_store", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לקנות קרואסון חם" -> {{"locationQuery": "bakery", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לשלוח מכתב בדואר" -> {{"locationQuery": "post_office", "requiredContext": null, "contextCondition": null, "dueDate": null}}
- "לחייג לאמא מחר ב10 בבוקר" -> {{"locationQuery": null, "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T10:00:00"}}
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
            
        parsed = json.loads(response_text)
        location_query = parsed.get("locationQuery")
        required_context = parsed.get("requiredContext")
        context_condition = parsed.get("contextCondition")
        due_date_str = parsed.get("dueDate")
        
        if due_date_str:
            due_date = datetime.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
            
    except Exception as e:
        print("Error in fetch_ai_details_for_telegram:", str(e))
        
    return {
        "locationQuery": location_query,
        "requiredContext": required_context,
        "contextCondition": context_condition,
        "dueDate": due_date
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_telegram_link_code(request):
    import random
    code = str(random.randint(1000, 9999))
    
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.telegram_link_code = code
    profile.telegram_link_code_expires = timezone.now() + datetime.timedelta(minutes=10)
    profile.save()
    
    return Response({"code": code}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def telegram_webhook(request):
    data = request.data
    
    # 1. Handle Callback Queries (Inline button clicks)
    if "callback_query" in data:
        callback_query = data.get("callback_query")
        callback_id = callback_query.get("id")
        chat_id = callback_query.get("message", {}).get("chat", {}).get("id")
        message_id = callback_query.get("message", {}).get("message_id")
        callback_data = callback_query.get("data")
        original_text = callback_query.get("message", {}).get("text", "")
        
        if not chat_id or not callback_data:
            return Response({"status": "ignored"})
            
        profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
        if not profile:
            answer_telegram_callback(callback_id, "Account not linked!")
            return Response({"status": "ignored"})
            
        if callback_data.startswith("complete_"):
            try:
                task_id = int(callback_data.replace("complete_", ""))
                task = Task.objects.filter(user=profile.user, id=task_id).first()
                if task:
                    task.is_completed = True
                    task.save(update_fields=['is_completed'])
                    
                    new_text = f"<s>{original_text}</s>\n\n✅ <b>Task Completed!</b>"
                    edit_telegram_message(chat_id, message_id, new_text)
                    answer_telegram_callback(callback_id, "Task marked as completed")
                else:
                    answer_telegram_callback(callback_id, "Task not found")
            except Exception as e:
                print("Error completing task via callback:", str(e))
                answer_telegram_callback(callback_id, "Error completing task")
                
        elif callback_data.startswith("mute_"):
            try:
                task_id = int(callback_data.replace("mute_", ""))
                task = Task.objects.filter(user=profile.user, id=task_id).first()
                if task:
                    task.is_muted = True
                    task.save(update_fields=['is_muted'])
                    
                    new_text = f"{original_text}\n\n🔕 <b>Alert Muted</b>"
                    edit_telegram_message(chat_id, message_id, new_text)
                    answer_telegram_callback(callback_id, "Task alert muted")
                else:
                    answer_telegram_callback(callback_id, "Task not found")
            except Exception as e:
                print("Error muting task via callback:", str(e))
                answer_telegram_callback(callback_id, "Error muting task")
                
        return Response({"status": "ok"})
        
    # 2. Handle Messages
    message = data.get("message")
    if not message:
        return Response({"status": "ignored"})
        
    chat = message.get("chat")
    if not chat:
        return Response({"status": "ignored"})
        
    chat_id = chat.get("id")
    
    # Process Voice Note
    if "voice" in message:
        voice = message["voice"]
        file_id = voice.get("file_id")
        
        profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
        if not profile:
            send_telegram_message(chat_id, "❌ <b>Account not linked.</b> Please link your account from the App settings to start adding tasks.")
            return Response({"status": "ok"})
            
        send_telegram_message(chat_id, "🎙️ <b>Processing voice message with AI...</b>")
        
        audio_bytes = download_telegram_file(file_id)
        if not audio_bytes:
            send_telegram_message(chat_id, "❌ <b>Failed to download voice note.</b> Please try again.")
            return Response({"status": "ok"})
            
        ai_data = parse_voice_message_with_ai(audio_bytes, user=profile.user)
        if not ai_data or not ai_data.get("title"):
            send_telegram_message(chat_id, "❌ <b>AI failed to parse your voice note.</b> Please speak clearly and try again.")
            return Response({"status": "ok"})
            
        try:
            due_date = None
            due_date_str = ai_data.get("dueDate")
            if due_date_str:
                due_date = datetime.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                
            task = Task.objects.create(
                user=profile.user,
                title=ai_data.get("title"),
                locationQuery=ai_data.get("locationQuery"),
                required_context=ai_data.get("requiredContext"),
                context_condition=ai_data.get("contextCondition"),
                due_date=due_date
            )
            
            loc_info = f"📍 {task.locationQuery}" if task.locationQuery else ""
            due_info = f"⏰ {task.due_date.strftime('%d/%m/%y %H:%M')}" if task.due_date else ""
            ctx_info = f"({task.required_context})" if task.required_context else ""
            
            send_telegram_message(chat_id, f"✅ <b>Task created via Voice!</b>\n\n📝 <b>{task.title}</b> {ctx_info}\n{due_info} {loc_info}")
        except Exception as err:
            print("Telegram voice task creation error:", str(err))
            send_telegram_message(chat_id, "❌ <b>Error creating task from voice note.</b>")
            
        return Response({"status": "ok"})
        
    # Process text messages
    text = message.get("text", "").strip()
    if not text:
        return Response({"status": "ignored"})
        
    if text.startswith("/start"):
        parts = text.split(" ")
        if len(parts) > 1 and parts[1].startswith("link_"):
            code = parts[1].replace("link_", "").strip()
            
            profile = UserProfile.objects.filter(
                telegram_link_code=code,
                telegram_link_code_expires__gt=timezone.now()
            ).first()
            
            if profile:
                profile.telegram_chat_id = str(chat_id)
                profile.telegram_link_code = None
                profile.telegram_link_code_expires = None
                profile.save()
                
                send_telegram_message(chat_id, f"🎉 <b>Connected successfully!</b>\nYour Telegram account is now linked to TaskAware user: <b>{profile.user.username}</b>.\n\nYou can start adding tasks directly by typing them here (e.g. 'Buy milk tomorrow morning').")
            else:
                send_telegram_message(chat_id, "❌ <b>Invalid or expired link code.</b>\nPlease generate a new code in the TaskAware app settings.")
        else:
            profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
            if profile:
                send_telegram_message(chat_id, f"Welcome back to TaskAware, <b>{profile.user.username}</b>! You can type any task description here to add it.")
            else:
                send_telegram_message(chat_id, "Welcome to <b>TaskAware Bot</b>! 📍\n\nTo start adding tasks, please link your account:\n1. Open settings in the TaskAware App.\n2. Tap 'Connect Telegram'.\n3. Copy the code or click the direct link.")
                
    elif text == "/help":
        send_telegram_message(chat_id, "💡 <b>How to use TaskAware Bot:</b>\n\n• Simply write any task (e.g. 'Buy milk tomorrow at 8 AM' or 'לקנות תרופות בסופר פארם').\n• Our AI will parse the title, context (home/work/gym), and suggested places (supermarket, pharmacy) and add it to your tasks list.\n\n<b>Commands:</b>\n• /start - Welcome & connection status\n• /tasks - Show your active tasks\n• /today - Show active tasks grouped by context\n• /help - Display this help guide")
        
    elif text == "/tasks":
        profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
        if not profile:
            send_telegram_message(chat_id, "❌ <b>Account not linked.</b> Please connect your account in the App settings first.")
        else:
            tasks = Task.objects.filter(user=profile.user, is_completed=False).order_by('due_date')
            if not tasks.exists():
                send_telegram_message(chat_id, "🎉 You have no active tasks!")
            else:
                msg = f"📋 <b>Your Active Tasks ({tasks.count()}):</b>\n\n"
                for i, t in enumerate(tasks):
                    due_str = t.due_date.strftime("%d/%m/%y %H:%M") if t.due_date else "No reminder"
                    loc_str = f"📍 {t.locationQuery}" if t.locationQuery else ""
                    ctx_str = f"({t.required_context})" if t.required_context else ""
                    msg += f"{i+1}. <b>{t.title}</b> {ctx_str}\n   ⏰ {due_str} {loc_str}\n\n"
                send_telegram_message(chat_id, msg)
                
    elif text == "/today":
        profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
        if not profile:
            send_telegram_message(chat_id, "❌ <b>Account not linked.</b> Please connect your account in the App settings first.")
        else:
            tasks = Task.objects.filter(user=profile.user, is_completed=False)
            if not tasks.exists():
                send_telegram_message(chat_id, "🎉 You have no active tasks!")
            else:
                context_groups = {
                    "home": [],
                    "work": [],
                    "school": [],
                    "gym": [],
                    "other": []
                }
                for t in tasks:
                    ctx = t.required_context
                    if ctx in context_groups:
                        context_groups[ctx].append(t)
                    else:
                        context_groups["other"].append(t)
                        
                msg = "📅 <b>Today's Tasks by Context:</b>\n\n"
                headers = {
                    "home": "🏠 <b>Home Context</b>",
                    "work": "💼 <b>Work Context</b>",
                    "school": "🏫 <b>School Context</b>",
                    "gym": "💪 <b>Gym Context</b>",
                    "other": "📋 <b>General / Other Tasks</b>"
                }
                
                has_content = False
                for key in ["home", "work", "school", "gym", "other"]:
                    group_tasks = context_groups[key]
                    if group_tasks:
                        has_content = True
                        msg += f"{headers[key]}:\n"
                        for t in group_tasks:
                            due_str = f"⏰ {t.due_date.strftime('%H:%M')}" if t.due_date else ""
                            loc_str = f"📍 {t.locationQuery}" if t.locationQuery else ""
                            cond_str = f"({t.context_condition})" if t.context_condition else ""
                            msg += f"• <b>{t.title}</b> {cond_str} {due_str} {loc_str}\n"
                        msg += "\n"
                        
                if not has_content:
                    msg = "🎉 You have no active tasks!"
                send_telegram_message(chat_id, msg)
                 
    else:
        # Free text -> Create task
        profile = UserProfile.objects.filter(telegram_chat_id=str(chat_id)).first()
        if not profile:
            send_telegram_message(chat_id, "❌ <b>Account not linked.</b> Please link your account from the App settings to start adding tasks.")
        else:
            try:
                ai_data = fetch_ai_details_for_telegram(text, profile.user)
                due_date = ai_data.get("dueDate")
                
                task = Task.objects.create(
                    user=profile.user,
                    title=text,
                    locationQuery=ai_data.get("locationQuery"),
                    required_context=ai_data.get("requiredContext"),
                    context_condition=ai_data.get("contextCondition"),
                    due_date=due_date
                )
                
                loc_info = f"📍 {task.locationQuery}" if task.locationQuery else ""
                due_info = f"⏰ {task.due_date.strftime('%d/%m/%y %H:%M')}" if task.due_date else ""
                
                send_telegram_message(chat_id, f"✅ <b>Task created!</b>\n\n📝 <b>{task.title}</b>\n{due_info} {loc_info}")
            except Exception as err:
                print("Telegram task creation error:", str(err))
                send_telegram_message(chat_id, f"❌ Failed to parse task automatically, saving as basic task:\n\n📝 <b>{text}</b>")
                Task.objects.create(user=profile.user, title=text)
                 
    return Response({"status": "ok"})


@api_view(['POST'])
@permission_classes([AllowAny])
def trigger_daily_digests(request):
    secret = os.environ.get("TELEGRAM_DIGEST_SECRET") or "taskaware-digest-secret-2026"
    auth_header = request.headers.get("Authorization")
    api_key = request.headers.get("X-Telegram-Digest-Key")
    
    authorized = False
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if token == secret:
            authorized = True
    elif api_key == secret:
        authorized = True
        
    if not authorized:
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
    profiles = UserProfile.objects.exclude(telegram_chat_id__isnull=True).exclude(telegram_chat_id='')
    
    sent_count = 0
    for profile in profiles:
        chat_id = profile.telegram_chat_id
        tasks = Task.objects.filter(user=profile.user, is_completed=False)
        if tasks.exists():
            context_groups = {
                "home": [],
                "work": [],
                "school": [],
                "gym": [],
                "other": []
            }
            for t in tasks:
                ctx = t.required_context
                if ctx in context_groups:
                    context_groups[ctx].append(t)
                else:
                    context_groups["other"].append(t)
            
            msg = f"🌅 <b>Good morning, {profile.user.username}!</b>\nHere is your daily TaskAware digest:\n\n"
            
            headers = {
                "home": "🏠 <b>Home Context</b>",
                "work": "💼 <b>Work Context</b>",
                "school": "🏫 <b>School Context</b>",
                "gym": "💪 <b>Gym Context</b>",
                "other": "📋 <b>General / Other Tasks</b>"
            }
            
            has_content = False
            for key in ["home", "work", "school", "gym", "other"]:
                group_tasks = context_groups[key]
                if group_tasks:
                    has_content = True
                    msg += f"{headers[key]}:\n"
                    for t in group_tasks:
                        due_str = f"⏰ {t.due_date.strftime('%H:%M')}" if t.due_date else ""
                        loc_str = f"📍 {t.locationQuery}" if t.locationQuery else ""
                        cond_str = f"({t.context_condition})" if t.context_condition else ""
                        msg += f"• <b>{t.title}</b> {cond_str} {due_str} {loc_str}\n"
                    msg += "\n"
            
            if has_content:
                send_telegram_message(chat_id, msg)
                sent_count += 1
                
    return Response({"status": "success", "sent_digests": sent_count}, status=status.HTTP_200_OK)


# --- WhatsApp Bot Helper & Views ---

def send_whatsapp_message(to_number, body):
    service_url = os.environ.get("WHATSAPP_SERVICE_URL")
    service_key = os.environ.get("WHATSAPP_SERVICE_KEY") or "taskaware-whatsapp-key-2026"
    if not service_url:
        print("WHATSAPP_SERVICE_URL is not configured")
        return
        
    url = f"{service_url.rstrip('/')}/send-message"
    payload = {
        "to": to_number,
        "text": body
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                'Content-Type': 'application/json',
                'X-Whatsapp-Service-Key': service_key
            }
        )
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            if not res_data.get("success"):
                print("WhatsApp service returned error:", res_data)
    except Exception as e:
        print("Failed to send WhatsApp message:", str(e))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_whatsapp_link_code(request):
    import random
    code = str(random.randint(1000, 9999))
    
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    profile.whatsapp_link_code = code
    profile.whatsapp_link_code_expires = timezone.now() + datetime.timedelta(minutes=10)
    profile.save()
    
    return Response({"code": code}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def whatsapp_webhook(request):
    service_key = os.environ.get("WHATSAPP_SERVICE_KEY") or "taskaware-whatsapp-key-2026"
    incoming_key = request.headers.get("X-Whatsapp-Service-Key")
    if incoming_key != service_key:
        return Response({"error": "Unauthorized"}, status=status.HTTP_401_UNAUTHORIZED)
        
    data = request.data
    sender_number = data.get("from")
    text = data.get("text", "").strip()
    media = data.get("media")
    
    if not sender_number:
        return Response({"status": "ignored"})
        
    profile = UserProfile.objects.filter(whatsapp_number=sender_number).first()
    
    # 1. Handle Link Code
    if not profile:
        code_match = re.search(r'\b\d{4}\b', text)
        code = code_match.group(0) if code_match else None
        
        if code:
            profile = UserProfile.objects.filter(
                whatsapp_link_code=code,
                whatsapp_link_code_expires__gt=timezone.now()
            ).first()
            
            if profile:
                profile.whatsapp_number = sender_number
                profile.whatsapp_link_code = None
                profile.whatsapp_link_code_expires = None
                profile.save()
                
                send_whatsapp_message(sender_number, f"🎉 *Connected successfully!*\nYour WhatsApp account is now linked to TaskAware user: *{profile.user.username}*.\n\nYou can start adding tasks directly by typing or sending a voice note.")
                return Response({"status": "ok"})
                
        send_whatsapp_message(sender_number, "Welcome to *TaskAware Bot*! 📍\n\nTo start adding tasks, please link your account:\n1. Open settings in the TaskAware App.\n2. Tap 'Connect WhatsApp'.\n3. Copy the code or click the direct link to send your code here.")
        return Response({"status": "ok"})
        
    # 2. Handle Voice Note
    if media and media.get("data") and media.get("mimetype", "").startswith("audio/"):
        import base64
        send_whatsapp_message(sender_number, "🎙️ *Processing voice message with AI...*")
        try:
            audio_bytes = base64.b64decode(media["data"])
            ai_data = parse_voice_message_with_ai(audio_bytes, mime_type=media.get("mimetype", "audio/ogg"), user=profile.user)
            
            if not ai_data or not ai_data.get("title"):
                send_whatsapp_message(sender_number, "❌ *AI failed to parse your voice note.* Please speak clearly and try again.")
                return Response({"status": "ok"})
                
            due_date = None
            due_date_str = ai_data.get("dueDate")
            if due_date_str:
                due_date = datetime.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                
            task = Task.objects.create(
                user=profile.user,
                title=ai_data.get("title"),
                locationQuery=ai_data.get("locationQuery"),
                required_context=ai_data.get("requiredContext"),
                context_condition=ai_data.get("contextCondition"),
                due_date=due_date
            )
            
            loc_info = f"📍 {task.locationQuery}" if task.locationQuery else ""
            due_info = f"⏰ {task.due_date.strftime('%d/%m/%y %H:%M')}" if task.due_date else ""
            ctx_info = f"({task.required_context})" if task.required_context else ""
            
            send_whatsapp_message(sender_number, f"✅ *Task created via Voice!*\n\n📝 *{task.title}* {ctx_info}\n{due_info} {loc_info}")
        except Exception as err:
            print("WhatsApp voice task creation error:", str(err))
            send_whatsapp_message(sender_number, "❌ *Error creating task from voice note.*")
            
        return Response({"status": "ok"})
        
    # 3. Process Text Replies & Commands
    text_lower = text.lower()
    
    complete_match = re.match(r'^(?:complete|finish|done)\s+(\d+)$', text_lower)
    mute_match = re.match(r'^(?:mute)\s+(\d+)$', text_lower)
    
    if complete_match:
        try:
            task_id = int(complete_match.group(1))
            task = Task.objects.filter(user=profile.user, id=task_id).first()
            if task:
                task.is_completed = True
                task.save(update_fields=['is_completed'])
                send_whatsapp_message(sender_number, f"✅ Task *'{task.title}'* completed successfully!")
            else:
                send_whatsapp_message(sender_number, "❌ Task not found.")
        except Exception as e:
            send_whatsapp_message(sender_number, "❌ Error completing task.")
            
    elif mute_match:
        try:
            task_id = int(mute_match.group(1))
            task = Task.objects.filter(user=profile.user, id=task_id).first()
            if task:
                task.is_muted = True
                task.save(update_fields=['is_muted'])
                send_whatsapp_message(sender_number, f"🔕 Alert for task *'{task.title}'* muted.")
            else:
                send_whatsapp_message(sender_number, "❌ Task not found.")
        except Exception as e:
            send_whatsapp_message(sender_number, "❌ Error muting task.")
            
    elif text == "tasks" or text_lower.startswith("/tasks"):
        tasks = Task.objects.filter(user=profile.user, is_completed=False).order_by('due_date')
        if not tasks.exists():
            send_whatsapp_message(sender_number, "🎉 You have no active tasks!")
        else:
            msg = f"📋 *Your Active Tasks ({tasks.count()}):*\n\n"
            for i, t in enumerate(tasks):
                due_str = t.due_date.strftime("%d/%m/%y %H:%M") if t.due_date else "No reminder"
                loc_str = f"📍 {t.locationQuery}" if t.locationQuery else ""
                ctx_str = f"({t.required_context})" if t.required_context else ""
                msg += f"{i+1}. *{t.title}* {ctx_str}\n   ⏰ {due_str} {loc_str}\n\n"
            send_whatsapp_message(sender_number, msg)
            
    elif text == "today" or text_lower.startswith("/today"):
        tasks = Task.objects.filter(user=profile.user, is_completed=False)
        if not tasks.exists():
            send_whatsapp_message(sender_number, "🎉 You have no active tasks!")
        else:
            context_groups = {
                "home": [],
                "work": [],
                "school": [],
                "gym": [],
                "other": []
            }
            for t in tasks:
                ctx = t.required_context
                if ctx in context_groups:
                    context_groups[ctx].append(t)
                else:
                    context_groups["other"].append(t)
                    
            msg = "📅 *Today's Tasks by Context:*\n\n"
            headers = {
                "home": "🏠 *Home Context*",
                "work": "💼 *Work Context*",
                "school": "🏫 *School Context*",
                "gym": "💪 *Gym Context*",
                "other": "📋 *General / Other Tasks*"
            }
            
            has_content = False
            for key in ["home", "work", "school", "gym", "other"]:
                group_tasks = context_groups[key]
                if group_tasks:
                    has_content = True
                    msg += f"{headers[key]}:\n"
                    for t in group_tasks:
                        due_str = f"⏰ {t.due_date.strftime('%H:%M')}" if t.due_date else ""
                        loc_str = f"📍 {t.locationQuery}" if t.locationQuery else ""
                        cond_str = f"({t.context_condition})" if t.context_condition else ""
                        msg += f"• *{t.title}* {cond_str} {due_str} {loc_str}\n"
                    msg += "\n"
                    
            if not has_content:
                msg = "🎉 You have no active tasks!"
            send_whatsapp_message(sender_number, msg)
            
    elif text == "help" or text_lower.startswith("/help"):
        send_whatsapp_message(sender_number, "💡 *How to use TaskAware WhatsApp Bot:*\n\n• Simply write any task (e.g. 'Buy milk tomorrow at 8 AM').\n• Send a voice note and our AI will transcribe and add it to your list.\n\n*Commands:*\n• *tasks* - Show your active tasks\n• *today* - Show tasks grouped by context\n• *complete <id>* - Mark task completed\n• *mute <id>* - Mute location alerts for task\n• *help* - Display this help guide")
        
    else:
        # Free text -> Create task
        try:
            ai_data = fetch_ai_details_for_telegram(text, profile.user)
            due_date = ai_data.get("dueDate")
            
            task = Task.objects.create(
                user=profile.user,
                title=text,
                locationQuery=ai_data.get("locationQuery"),
                required_context=ai_data.get("requiredContext"),
                context_condition=ai_data.get("contextCondition"),
                due_date=due_date
            )
            
            loc_info = f"📍 {task.locationQuery}" if task.locationQuery else ""
            due_info = f"⏰ {task.due_date.strftime('%d/%m/%y %H:%M')}" if task.due_date else ""
            
            send_whatsapp_message(sender_number, f"✅ *Task created!*\n\n📝 *{task.title}*\n{due_info} {loc_info}")
        except Exception as err:
            print("WhatsApp task creation error:", str(err))
            send_whatsapp_message(sender_number, f"❌ Failed to parse task, saving as basic task:\n\n📝 *{text}*")
            Task.objects.create(user=profile.user, title=text)
            
    return Response({"status": "ok"})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def nearby_suggestions(request):
    user_lat = request.data.get('latitude') or request.data.get('lat')
    user_lng = request.data.get('longitude') or request.data.get('lng')
    category = request.data.get('category', '').strip()

    if user_lat is None or user_lng is None or not category:
        return Response({'error': 'Missing latitude, longitude or category'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user_lat = float(user_lat)
        user_lng = float(user_lng)
    except ValueError:
        return Response({'error': 'Invalid coordinates'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        search_result = None
        for radius_m in (1200, 2500, 5000):
            search_result = google_places_search(category, user_lat, user_lng, radius_m)
            if search_result and search_result.get("places"):
                break
        
        places = search_result["places"] if search_result else []
        suggestions = []
        for p in places[:3]:
            suggestions.append({
                "name": p["name"],
                "formatted_address": p["address"],
                "coords_lat": p["lat"],
                "coords_lng": p["lng"],
                "distance_m": p["distance_m"],
                "place_id": p.get("place_id"),
            })
        
        return Response({"suggestions": suggestions})
    except Exception as e:
        print("Error in nearby_suggestions:", str(e))
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "healthy"}, status=status.HTTP_200_OK)