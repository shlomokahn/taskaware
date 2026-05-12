# ?? Expo Updates - System Complete Guide

## מה בנינו?

מערכת **מלאה** להפצת עדכונים עם **Expo Updates** + **API Backend**

### ?? **התוצאה הסופית:**
- ? משתמש פותח אפליקציה
- ? Modal מופיע: "New Update Available v1.0.1"
- ? לחיצה "Update Now"
- ? מורידה ומחדשת בתוך **5 שניות**
- ? ?? אפליקציה עם קוד חדש!

---

## ??? הארכיטקטורה

### **Frontend:**
```
App.js
  ?? UpdateChecker.js
     ?? Checks Expo Updates
     ?? Checks API for version
     ?? Shows Modal with download
```

### **Backend:**
```
Django API
  ?? GET /api/check-update/ - בדיקה לגרסה
  ?? POST /api/create-version/ - יצירת גרסה (admin)
```

### **Expo Infrastructure:**
```
Expo EAS Updates
  ?? Hosts your JavaScript updates
     ?? Fast OTA delivery
```

---

## ?? איך להשתמש - שלבים בסיסיים

### **שלב 1: שנה קוד באפליקציה**

לדוגמה, ב-`LoginScreen.js`:
```javascript
// Change any UI/Logic
<Text>TaskAware v1.0.1 - Bug fixes!</Text>
```

עדכן גם את הגרסה ב-`app.json`:
```json
{
  "version": "1.0.1"
}
```

### **שלב 2: בדוק לוקלי**

```bash
cd frontend
npm start
# Test on simulator/device
```

### **שלב 3: פרסם העדכון**

```bash
eas update --branch main --message "Version 1.0.1 - Improvements"
```

? **Done!** משתמשים מקבלים את העדכון בתוך דקה!

---

## ?? זרימת משתמש מלאה

```
1. משתמש פותח את האפליקציה
   ?
2. UpdateChecker.checkForUpdates() רץ
   ?
3. בודק דרך:
   - Expo Updates (בקוד)
   - API שלנו (גרסה)
   ?
4. אם יש עדכון:
   ?
5. Modal מופיע עם:
   - שם הגרסה
   - הערות שחרור
   - [Skip] [Update Now] buttons
   ?
6. משתמש לוחץ "Update Now"
   ?
7. handleUpdate() רץ:
   - Updates.checkForUpdateAsync()
   - Updates.fetchUpdateAsync()
   - Updates.reloadAsync()
   ?
8. ? Loading spinner
   ?
9. ?? Download (few seconds)
   ?
10. ?? App reloads
   ?
11. ? NEW CODE!
```

---

## ?? Configuration Files

### **app.json** (Already configured)
```json
{
  "version": "1.0.0",
  "runtimeVersion": {
    "policy": "appVersion"
  },
  "updates": {
    "url": "https://u.expo.dev/24e2be65-d267-48fc-a4a1-0b4fbbe694d6"
  }
}
```

### **eas.json** (Already configured)
```json
{
  "build": {
    "production": {
      "autoIncrement": true,
      "distribution": "internal"
    }
  }
}
```

### **package.json** (Already has expo-updates)
```json
{
  "dependencies": {
    "expo-updates": "~29.0.17"
  }
}
```

---

## ?? Common Scenarios

### **Scenario 1: Quick UI Fix**
```bash
# Change button color in LoginScreen
eas update --branch main
# ? Users see it instantly!
```

### **Scenario 2: Mandatory Security Update**
```bash
# Backend - Create mandatory version
python manage.py shell
from api.models import AppVersion
AppVersion.objects.create(
    version='1.0.1',
    release_notes='Security fix - required',
    is_mandatory=True
)

# Frontend - Push update
eas update --branch main
# ? Users see Alert - MUST update
```

### **Scenario 3: New Package/Native Change**
```bash
# Need NEW APK!
npm install some-new-package
eas build --platform android --profile production
# Wait for build...
eas update --branch main
```

---

## ?? Update Types

### **Type 1: JavaScript Only Update** ? (Fast)
```bash
eas update --branch main
# Time: ~30 seconds
```

### **Type 2: With Native Code** ?? (Slower)
```bash
npm install native-package
eas build --platform android --profile production
# Time: ~10 minutes
```

---

## ?? Monitoring & Debugging

### **Check available updates:**
```bash
eas update:list --branch main
```

### **View specific update:**
```bash
eas update:view <update-id>
```

### **Local testing:**
```bash
cd frontend
npm start
# Simulate update check
```

---

## ?? When to Use What

| Situation | Solution |
|-----------|----------|
| Fix typo in UI | `eas update` |
| Change login flow | `eas update` |
| Add npm package | `eas build` + `eas update` |
| Change permissions | `eas build` + `eas update` |
| Native module change | `eas build` + `eas update` |
| App icon change | `eas build` + `eas update` |

---

## ? Pre-Update Checklist

- [ ] Made code changes
- [ ] Tested locally (`npm start`)
- [ ] Updated version in `app.json`
- [ ] Committed to git
- [ ] No TypeScript errors
- [ ] No console errors

---

## ?? Publish Process (Summary)

```bash
# 1. Make changes
# 2. Test locally
# 3. Update version
eas update --branch main --message "v1.0.1 - Description"
# 4. Monitor: eas update:list --branch main
# 5. Done!
```

---

## ?? File Structure

```
frontend/
??? App.js (has UpdateChecker)
??? app.json (with updates config)
??? eas.json (build config)
??? package.json (has expo-updates)
??? src/
?   ??? components/
?   ?   ??? UpdateChecker.js ?
?   ??? screens/
?       ??? LoginScreen.js
??? EXPO_UPDATES_GUIDE.md

backend/
??? api/
?   ??? models.py (AppVersion model)
?   ??? views.py (check-update, create-version)
?   ??? urls.py (endpoints)
?   ??? serializers.py (AppVersionSerializer)
?   ??? migrations/
?       ??? 0005_appversion.py
```

---

## ?? Key Concepts

### **OTA (Over-The-Air)**
Push app updates without going through stores

### **Runtime Version**
Determines which updates are compatible

### **Branch**
Where your updates are stored (`main`, `staging`, etc.)

### **Manifest**
Tells the app what code to run

---

## ?? Troubleshooting

| Problem | Solution |
|---------|----------|
| Modal doesn't show | Check `App.js` has `<UpdateChecker>` |
| Update doesn't download | Check internet, check `eas update:list` |
| App crashes after update | Run `npm start --clear` locally |
| Version not incrementing | Make actual code changes |

---

## ?? Success Indicators

- ? `eas update:list --branch main` shows your update
- ? Test device shows Modal
- ? Clicking "Update" downloads
- ? App reloads with new code
- ? No console errors

---

## ?? Quick Commands Reference

```bash
# Update the app
eas update --branch main

# List all updates
eas update:list --branch main

# View specific update
eas update:view <id>

# Test locally
npm start

# Delete old update
eas update:delete <id>

# Test build
eas build --platform android --profile production
```

---

## ?? Next Steps

1. **Make a test change** in LoginScreen
2. **Run `npm start`** to verify
3. **Run `eas update --branch main`**
4. **Check your phone** for update notification
5. **Tap "Update Now"**
6. **See the change instantly!** ??

---

## ?? Pro Tips

1. **Version your updates** - Increment each time
2. **Write good release notes** - Users will read them
3. **Test on real device** - Not just simulator
4. **Monitor uptake** - Use `eas update:list`
5. **Keep updates small** - Better performance
6. **Never publish broken code** - Always test first

---

## ?? Full Resource Files

- ?? `frontend/EXPO_UPDATES_GUIDE.md` - Detailed guide
- ?? `UPDATE_SYSTEM_COMPLETE.md` - This file
- ?? `frontend/src/components/UpdateChecker.js` - Component code
- ?? `backend/django/api/models.py` - AppVersion model
- ?? `backend/django/api/views.py` - API endpoints

---

## ?? TLDR (Too Long; Didn't Read)

```bash
# 1. Change code
# 2. Test locally: npm start
# 3. Update version in app.json
# 4. Publish: eas update --branch main
# 5. Users see Modal with "Update Now"
# 6. They tap it
# 7. App updates in 5 seconds
# 8. ? Done!
```

---

**?? You're all set! Happy updating!**
