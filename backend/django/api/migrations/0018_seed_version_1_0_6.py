from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.6',
        defaults={
            'release_notes': 'Added device location display and manual sync button to home screen, removing sorting options.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0017_seed_version_1_0_5'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
