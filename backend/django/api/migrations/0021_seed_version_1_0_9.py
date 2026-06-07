from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.9',
        defaults={
            'release_notes': 'Add OpenStreetMap Nominatim geocoding fallback to resolve exact street addresses in Hebrew.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0020_seed_version_1_0_8'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
