from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.1.0.1',
        defaults={
            'release_notes': 'Hotfix: Added voice recording microphone button to the Add Task modal.',
            'is_mandatory': True
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0022_seed_version_1_1_0'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
