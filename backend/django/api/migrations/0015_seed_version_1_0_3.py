from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.0.3',
        defaults={
            'release_notes': 'Profile security configurations, modal layout fixes, and Android keyboard spacing optimizations.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0014_seed_version_1_0_2'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
