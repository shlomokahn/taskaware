from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.1.0.2',
        defaults={
            'release_notes': 'Hotfix: Time-awareness and relative date calculations for manually created tasks.',
            'is_mandatory': True
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0023_seed_version_1_1_0_1'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
