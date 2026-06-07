from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.1.0.3',
        defaults={
            'release_notes': 'Dynamic location categories and preferred branch proximity reminders.',
            'is_mandatory': True
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_remove_choices_validation'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
