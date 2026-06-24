import os
import json
import datetime
import urllib.parse
import urllib.request
from collections import Counter
from django.utils import timezone
from packaging import version as packaging_version
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from google import genai
from google.genai import types
from api.models import UserContext, UserContextVisit, UserProfile, AppVersion
from api.serializers import AppVersionSerializer
from .views_helpers import send_expo_push_notification, GOOGLE_PLACES_API_KEY

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

def predict_next_visit(user, context_key):
    if not user or not user.is_authenticated or not context_key:
        return None
    try:
        visits = UserContextVisit.objects.filter(
            user=user,
            context_key=context_key,
            was_visited=True,
            last_visited_at__isnull=False
        ).order_by('-last_visited_at')[:30]
        
        if visits.count() < 3:
            return None
            
        days = [v.last_visited_at.weekday() for v in visits]
        hours = [v.last_visited_at.hour for v in visits]
        
        most_common_day = Counter(days).most_common(1)[0][0]
        most_common_hour = Counter(hours).most_common(1)[0][0]
        
        today = timezone.localtime(timezone.now())
        days_ahead = most_common_day - today.weekday()
        if days_ahead < 0:
            days_ahead += 7
        elif days_ahead == 0 and today.hour >= most_common_hour:
            days_ahead += 7
            
        predicted_date = today.date() + datetime.timedelta(days=days_ahead)
        predicted_datetime = datetime.datetime.combine(predicted_date, datetime.time(hour=most_common_hour))
        predicted_datetime = timezone.make_aware(predicted_datetime, timezone.get_current_timezone())
        
        return predicted_datetime.isoformat()
    except Exception as e:
        print("Error predicting next visit:", str(e))
        return None

def get_nearby_places_prompt_context(lat, lng):
    if not lat or not lng or not GOOGLE_PLACES_API_KEY:
        return ""
    try:
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": f"{lat},{lng}",
            "radius": "150",
            "key": GOOGLE_PLACES_API_KEY
        }
        query_string = urllib.parse.urlencode(params)
        req = urllib.request.Request(f"{url}?{query_string}")
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            results = res_data.get("results", [])
            places_str = []
            for r in results[:5]:
                name = r.get("name")
                types = r.get("types", [])
                primary_type = types[0] if types else "establishment"
                places_str.append(f"{name} ({primary_type})")
            return ", ".join(places_str)
    except Exception as e:
        print("Error getting nearby places for prompt context:", str(e))
        return ""

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
def ask_ai(request):
    title = request.data.get('title')
    device_time = request.data.get('deviceTime')
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')

    if not title:
        return Response({"error": "חסר שם משימה"}, status=400)

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        current_time_str = device_time if device_time else timezone.now().isoformat()
        choices = get_user_context_choices(request.user)
        choices_str = ", ".join([f"'{c}'" for c in choices])

        nearby_places_str = ""
        if lat and lng:
            nearby_places_str = get_nearby_places_prompt_context(float(lat), float(lng))

        nearby_context = ""
        if nearby_places_str:
            nearby_context = f"\nUser's Current Nearby Places (radius 150m): {nearby_places_str}\n"

        prompt = f"""You are a smart assistant for a task management app. The user will give you a task description in Hebrew or English.
Analyze it and return a valid JSON array of task objects ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.
If the description contains multiple tasks (e.g. "buy milk and deposit check"), split them into separate objects in the array. If there is only one task, return an array with one object.

Task: '{title}'
{nearby_context}
JSON Schema (Return a JSON Array of this object):
[
  {{
    "title": "Clean, concise task description / title in its original language (Hebrew or English)",
    "locationQuery": "place type or specific business name in English. Map tasks semantically to one of these category keys if they are related:
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
     Or null if the task is not related to a physical place category. Be extremely smart and classify specific products/items to their corresponding category, even if the category name itself is not mentioned.
     If the user specifies a relative location like 'here', 'nearby', 'this place' (כאן, פה, לידי, לידנו) and you have a 'User's Current Nearby Places' list above, match it to the most relevant place name or category from that list.",
    "requiredContext": "context key if mentioned, else null (choices: {choices_str})",
    "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')",
    "dueDate": "ISO 8601 date time string if date/time is mentioned relative to current time, else null"
  }}
]

Current Time Context: {current_time_str}

Examples:
- "לקנות חלב וגבינה אחרי העבודה" -> [{{"title": "לקנות חלב וגבינה", "locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after", "dueDate": null}}]
- "לקנות אדוויל מחר בבוקר ולמשוך כסף" -> [
    {{"title": "לקנות אדוויל", "locationQuery": "pharmacy", "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T08:00:00"}},
    {{"title": "למשוך כסף", "locationQuery": "atm", "requiredContext": null, "contextCondition": null, "dueDate": null}}
  ]
- "לקנות קפה כאן" (when Aroma (cafe) is nearby) -> [{{"title": "לקנות קפה כאן", "locationQuery": "Aroma", "requiredContext": "cafe", "contextCondition": "during", "dueDate": null}}]
- "ללמוד למבחן בספרייה לפני הלימודים" -> [{{"title": "ללמוד למבחן בספרייה", "locationQuery": "library", "requiredContext": "school", "contextCondition": "before", "dueDate": null}}]
- "לקנות קרואסון חם" -> [{{"title": "לקנות קרואסון חם", "locationQuery": "bakery", "requiredContext": null, "contextCondition": null, "dueDate": null}}]
- "להפקיד צ'ק בבנק" -> [{{"title": "להפקיד צ'ק בבנק", "locationQuery": "bank", "requiredContext": "bank", "contextCondition": "during", "dueDate": null}}]
- "לחייג לאמא מחר ב10 בבוקר" -> [{{"title": "לחייג לאמא", "locationQuery": null, "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T10:00:00"}}]
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

        tasks_list = []
        try:
            parsed = json.loads(response_text)
            if isinstance(parsed, list):
                tasks_list = parsed
            elif isinstance(parsed, dict):
                tasks_list = [parsed]
        except Exception as json_err:
            print("Failed to parse JSON from Gemini response:", response_text, str(json_err))
            tasks_list = [{
                "title": title,
                "locationQuery": response_text.replace('.', '').strip(),
                "requiredContext": None,
                "contextCondition": None,
                "dueDate": None
            }]

        for task in tasks_list:
            location_query = task.get("locationQuery")
            required_context = task.get("requiredContext")
            dueDate = task.get("dueDate")
            
            if not location_query and not required_context and not dueDate:
                task["locationQuery"] = "supermarket"
                location_query = "supermarket"
                
            task["suggestedDueDate"] = None
            if not dueDate:
                predict_key = required_context or location_query
                if predict_key:
                    task["suggestedDueDate"] = predict_next_visit(request.user, predict_key.strip().lower())

        try:
            profile = UserProfile.objects.get(user=request.user)
            if profile.expo_push_token:
                notified_queries = [t.get("locationQuery") for t in tasks_list if t.get("locationQuery")]
                if notified_queries:
                    body_text = f"for the tasks, Search the area: {', '.join(notified_queries)}"
                    send_expo_push_notification(
                        expo_token=profile.expo_push_token,
                        title="The AI ​​has found a location! 📍",
                        body=body_text
                    )
        except Exception as e:
            print("Push error in AI:", str(e))

        print(f"AI Answered: parsed {len(tasks_list)} tasks.")
        return Response(tasks_list)

    except Exception as e:
        print("Gemini API Error details:", str(e))
        return Response({"error": "שגיאה בפנייה למודל ה-AI"}, status=500)

def parse_voice_message_with_ai(audio_bytes, mime_type='audio/ogg', device_time=None, user=None, latitude=None, longitude=None):
    gemini_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_key:
        return None

    try:
        choices = get_user_context_choices(user)
        choices_str = ", ".join([f"'{c}'" for c in choices])
        current_time_str = device_time if device_time else timezone.now().isoformat()

        nearby_places_str = ""
        if latitude and longitude:
            nearby_places_str = get_nearby_places_prompt_context(float(latitude), float(longitude))

        nearby_context = ""
        if nearby_places_str:
            nearby_context = f"\nUser's Current Nearby Places (radius 150m): {nearby_places_str}\n"

        prompt = f"""You are a smart assistant for a task management app.
The user has provided a voice message (audio) in Hebrew or English.
First, transcribe the voice message accurately.
Second, analyze the transcription to extract structured task information.
Return a valid JSON array of task objects ONLY. Do not write any markdown formatting, do not write ```json ... ```, do not write explanations.
If the description contains multiple tasks (e.g. "buy milk and deposit check"), split them into separate objects in the array. If there is only one task, return an array with one object.

{nearby_context}
JSON Schema (Return a JSON Array of this object):
[
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
     Or null if the task is not related to a physical place category. Be extremely smart and classify specific products/items to their corresponding category, even if the category name itself is not mentioned.
     If the user specifies a relative location like 'here', 'nearby', 'this place' (כאן, פה, לידי, לידנו) and you have a 'User's Current Nearby Places' list above, match it to the most relevant place name or category from that list.",
    "requiredContext": "context key if mentioned, else null (choices: {choices_str})",
    "contextCondition": "relation to context if mentioned, else null (choices: 'before', 'during', 'after')",
    "dueDate": "ISO 8601 date time string if date/time is mentioned relative to current time, else null"
  }}
]

Current Time Context: {current_time_str}

Examples:
- Audio saying "לקנות חלב אחרי העבודה" -> [{{"title": "לקנות חלב אחרי העבודה", "locationQuery": "supermarket", "requiredContext": "work", "contextCondition": "after", "dueDate": null}}]
- Audio saying "לקנות אדוויל מחר בבוקר ולמשוך כסף" -> [
    {{"title": "לקנות אדוויל מחר בבוקר", "locationQuery": "pharmacy", "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T08:00:00"}},
    {{"title": "למשוך כסף", "locationQuery": "atm", "requiredContext": null, "contextCondition": null, "dueDate": null}}
  ]
- Audio saying "לקנות קפה כאן" (when Aroma (cafe) is nearby) -> [{{"title": "לקנות קפה כאן", "locationQuery": "Aroma", "requiredContext": "cafe", "contextCondition": "during", "dueDate": null}}]
- Audio saying "ללמוד למבחן בספרייה לפני הלימודים" -> [{{"title": "ללמוד למבחן בספרייה", "locationQuery": "library", "requiredContext": "school", "contextCondition": "before", "dueDate": null}}]
- Audio saying "לקנות קרואסון חם" -> [{{"title": "לקנות קרואסון חם", "locationQuery": "bakery", "requiredContext": null, "contextCondition": null, "dueDate": null}}]
- Audio saying "להפקיד צ'ק בבנק" -> [{{"title": "להפקיד צ'ק בבנק", "locationQuery": "bank", "requiredContext": "bank", "contextCondition": "during", "dueDate": null}}]
- Audio saying "לחייג לאמא מחר ב10 בבוקר" -> [{{"title": "לחייג לאמא", "locationQuery": null, "requiredContext": null, "contextCondition": null, "dueDate": "2026-06-08T10:00:00"}}]
"""

        client = genai.Client(api_key=gemini_key)
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
        if isinstance(parsed, list):
            return parsed
        elif isinstance(parsed, dict):
            return [parsed]
        return None
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
def health_check(request):
    return Response({"status": "healthy"}, status=status.HTTP_200_OK)
