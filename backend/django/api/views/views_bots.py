import os
import json
import datetime
import re
import urllib.parse
import urllib.request
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from api.models import Task, UserProfile
from .views_ai import parse_voice_message_with_ai, fetch_ai_details_for_telegram

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
        
    message = data.get("message")
    if not message:
        return Response({"status": "ignored"})
        
    chat = message.get("chat")
    if not chat:
        return Response({"status": "ignored"})
        
    chat_id = chat.get("id")
    
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
            
        ai_data_list = parse_voice_message_with_ai(audio_bytes, user=profile.user)
        if not ai_data_list:
            send_telegram_message(chat_id, "❌ <b>AI failed to parse your voice note.</b> Please speak clearly and try again.")
            return Response({"status": "ok"})
            
        try:
            created_titles = []
            for ai_data in ai_data_list:
                due_date = None
                due_date_str = ai_data.get("dueDate")
                if due_date_str:
                    due_date = datetime.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                    
                task = Task.objects.create(
                    user=profile.user,
                    title=ai_data.get("title") or "Voice Task",
                    locationQuery=ai_data.get("locationQuery"),
                    required_context=ai_data.get("requiredContext"),
                    context_condition=ai_data.get("contextCondition"),
                    due_date=due_date
                )
                created_titles.append(task.title)
            
            send_telegram_message(chat_id, f"✅ <b>{len(created_titles)} Task(s) created via Voice!</b>\n\n" + "\n".join([f"• <b>{title}</b>" for title in created_titles]))
        except Exception as err:
            print("Telegram voice task creation error:", str(err))
            send_telegram_message(chat_id, "❌ <b>Error creating task from voice note.</b>")
            
        return Response({"status": "ok"})
        
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
        
    if media and media.get("data") and media.get("mimetype", "").startswith("audio/"):
        import base64
        send_whatsapp_message(sender_number, "🎙️ *Processing voice message with AI...*")
        try:
            audio_bytes = base64.b64decode(media["data"])
            ai_data_list = parse_voice_message_with_ai(audio_bytes, mime_type=media.get("mimetype", "audio/ogg"), user=profile.user)
            
            if not ai_data_list:
                send_whatsapp_message(sender_number, "❌ *AI failed to parse your voice note.* Please speak clearly and try again.")
                return Response({"status": "ok"})
                
            created_titles = []
            for ai_data in ai_data_list:
                due_date = None
                due_date_str = ai_data.get("dueDate")
                if due_date_str:
                    due_date = datetime.datetime.fromisoformat(due_date_str.replace("Z", "+00:00"))
                    
                task = Task.objects.create(
                    user=profile.user,
                    title=ai_data.get("title") or "Voice Task",
                    locationQuery=ai_data.get("locationQuery"),
                    required_context=ai_data.get("requiredContext"),
                    context_condition=ai_data.get("contextCondition"),
                    due_date=due_date
                )
                created_titles.append(task.title)
                
            send_whatsapp_message(sender_number, f"✅ *{len(created_titles)} Task(s) created via Voice!*\n\n" + "\n".join([f"• *{title}*" for title in created_titles]))
        except Exception as err:
            print("WhatsApp voice task creation error:", str(err))
            send_whatsapp_message(sender_number, "❌ *Error creating task from voice note.*")
            
        return Response({"status": "ok"})
        
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
