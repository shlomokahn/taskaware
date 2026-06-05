from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_contextvisit_task_conditional_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='userprofile',
            name='notifications_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='dnd_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='dnd_start',
            field=models.CharField(default='22:00', max_length=5),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='dnd_end',
            field=models.CharField(default='07:00', max_length=5),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='notification_radius',
            field=models.IntegerField(default=300),
        ),
        migrations.AddField(
            model_name='userprofile',
            name='muted_contexts',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
