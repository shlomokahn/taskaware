from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.7',
        defaults={
            'release_notes': 'Added geocoded place names instead of coordinates for device location display on home screen.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0018_seed_version_1_0_6'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
