from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0007_userprofile_location_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='notification_id',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
