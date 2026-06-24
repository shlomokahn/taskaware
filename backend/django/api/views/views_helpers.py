import os
import re
import math
import json
import urllib.parse
import urllib.request
import datetime
from django.utils import timezone
from api.models import Task, UserProfile, UserContext, UserContextVisit
from exponent_server_sdk import PushClient, PushMessage

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

VALID_HEBREW_PREFIXES = {
    # Single
    "ב", "ה", "ו", "ל", "מ", "ש", "כ",
    # Double
    "וה", "וב", "ול", "ומ", "וש", "וכ",
    "שה", "שב", "של", "שמ", "שכ",
    # Triple
    "וכש", "שכש"
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
    if not query:
        return None, None
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
        raise RuntimeError("Missing GOOGLE_PLACES environment variable")

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
                
            if alert_sent:
                # Update last notified positions
                for task in notify_list:
                    task.last_notified_lat = user_lat
                    task.last_notified_lng = user_lng
                    task.save(update_fields=['last_notified_lat', 'last_notified_lng'])
