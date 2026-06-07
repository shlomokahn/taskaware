from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0024_seed_version_1_1_0_2'),
    ]

    operations = [
        migrations.AlterField(
            model_name='usercontext',
            name='key',
            field=models.CharField(max_length=40),
        ),
        migrations.AlterField(
            model_name='task',
            name='required_context',
            field=models.CharField(blank=True, max_length=40, null=True),
        ),
        migrations.AlterField(
            model_name='usercontextvisit',
            name='context_key',
            field=models.CharField(max_length=40),
        ),
    ]
