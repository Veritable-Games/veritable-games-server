#!/bin/bash

echo "=== Testing Environment Variable Decryption ==="
echo ""

docker exec coolify php -r "
require '/var/www/html/vendor/autoload.php';
\$app = require_once '/var/www/html/bootstrap/app.php';
\$app->make('Illuminate\\Contracts\\Console\\Kernel')->bootstrap();

\$vars = DB::table('environment_variables')
    ->where('resourceable_id', 1)
    ->where('resourceable_type', 'App\\\\Models\\\\Application')
    ->get();

echo 'Testing ' . count(\$vars) . ' environment variables...' . PHP_EOL;
echo '' . PHP_EOL;

\$failed = [];
foreach (\$vars as \$var) {
    try {
        \$decrypted = decrypt(\$var->value);
        \$decrypted_len = strlen(\$decrypted);
        echo '✓ ' . \$var->key . ' (encrypted=' . strlen(\$var->value) . ', decrypted=' . \$decrypted_len . ')' . PHP_EOL;
    } catch (Exception \$e) {
        echo '✗ ' . \$var->key . ' (len=' . strlen(\$var->value) . ') - ' . \$e->getMessage() . PHP_EOL;
        \$failed[] = [
            'id' => \$var->id,
            'key' => \$var->key,
            'error' => \$e->getMessage()
        ];
    }
}

echo '' . PHP_EOL;

if (count(\$failed) === 0) {
    echo '✅ SUCCESS: All environment variables can be decrypted!' . PHP_EOL;
} else {
    echo '❌ FAILED: ' . count(\$failed) . ' variables are corrupted:' . PHP_EOL;
    foreach (\$failed as \$f) {
        echo '   ID ' . \$f['id'] . ': ' . \$f['key'] . ' - ' . \$f['error'] . PHP_EOL;
    }
    echo '' . PHP_EOL;
    echo 'To fix, run:' . PHP_EOL;
    echo '  docker exec coolify-db psql -U coolify -d coolify -c \"DELETE FROM environment_variables WHERE id IN (' . implode(',', array_column(\$failed, 'id')) . ');\"' . PHP_EOL;
}
"
