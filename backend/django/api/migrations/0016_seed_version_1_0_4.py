from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.4',
        defaults={
            'release_notes': 'Testing the OTA update flow with version 1.0.4 live. Features final layout optimizations.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0015_seed_version_1_0_3'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
