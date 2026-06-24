import json
import urllib.parse
import urllib.request
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .views_helpers import GOOGLE_PLACES_API_KEY, google_places_search

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
