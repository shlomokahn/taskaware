from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.5',
        defaults={
            'release_notes': 'Added Android Safe Area layout compatibility to prevent content overlaying top/bottom system navigation bars.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0016_seed_version_1_0_4'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
