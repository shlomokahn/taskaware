from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0012_userprofile_whatsapp_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='profile_picture',
            field=models.TextField(blank=True, null=True),
        ),
    ]
