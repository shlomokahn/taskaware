from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.2',
        defaults={
            'release_notes': 'Added profile picture upload, username and password change options with premium styling.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0013_userprofile_profile_picture'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
