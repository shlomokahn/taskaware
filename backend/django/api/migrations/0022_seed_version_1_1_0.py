from django.db import migrations

def seed_app_version(apps, schema_editor):
    AppVersion = apps.get_model('api', 'AppVersion')
    AppVersion.objects.update_or_create(
        version='1.1.0',
        defaults={
            'release_notes': 'Forced global Left-to-Right (LTR) layout direction and aligned all screen text alignments and button flows to match LTR layout.',
            'is_mandatory': False
        }
    )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0021_seed_version_1_0_9'),
    ]

    operations = [
        migrations.RunPython(seed_app_version),
    ]
