from django.db import migrations, models
from django.utils import timezone
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_task_notification_id'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='required_context',
            field=models.CharField(blank=True, choices=[('work', 'Work'), ('home', 'Home'), ('school', 'School'), ('gym', 'Gym')], max_length=40, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='context_condition',
            field=models.CharField(blank=True, choices=[('before', 'Before'), ('during', 'During'), ('after', 'After')], max_length=20, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='is_muted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='task',
            name='last_notified_lat',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='last_notified_lng',
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.CreateModel(
            name='UserContextVisit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('context_key', models.CharField(choices=[('work', 'Work'), ('home', 'Home'), ('school', 'School'), ('gym', 'Gym')], max_length=40)),
                ('date', models.DateField(default=timezone.now)),
                ('was_visited', models.BooleanField(default=False)),
                ('last_visited_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='context_visits', to='auth.user')),
            ],
        ),
        migrations.AddConstraint(
            model_name='usercontextvisit',
            constraint=models.UniqueConstraint(fields=('user', 'context_key', 'date'), name='unique_user_context_visit_daily'),
        ),
    ]
