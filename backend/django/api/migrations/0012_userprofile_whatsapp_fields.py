from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0011_userprofile_telegram_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='whatsapp_number',
            field=models.CharField(blank=True, max_length=50, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='whatsapp_link_code',
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='whatsapp_link_code_expires',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
