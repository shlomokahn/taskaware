from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0010_userprofile_settings_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='telegram_chat_id',
            field=models.CharField(blank=True, max_length=100, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='telegram_link_code',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='telegram_link_code_expires',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
