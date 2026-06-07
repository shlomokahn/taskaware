from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.8',
        defaults={
            'release_notes': 'Added English labels for device location and updated the manual sync button to be an icon-only circular layout.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0019_seed_version_1_0_7'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
