# Deploy All Supabase Edge Functions
# Run this script in PowerShell from the project root

Write-Host "🚀 Deploying All Supabase Edge Functions..." -ForegroundColor Green
Write-Host ""

# List of all functions to deploy (excluding _shared which is not a function)
$functions = @(
    "admin-templates",
    "analyze-workflow-requirements",
    "chat-api",
    "chatbot",
    "copy-template",
    "execute-agent",
    "execute-workflow",
    "form-trigger",
    "generate-workflow",
    "webhook-trigger"
)

$deployed = @()
$failed = @()

foreach ($function in $functions) {
    Write-Host "📦 Deploying $function..." -ForegroundColor Yellow
    
    try {
        $result = npx supabase@latest functions deploy $function 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $function deployed successfully" -ForegroundColor Green
            $deployed += $function
        } else {
            Write-Host "❌ $function deployment failed" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            $failed += $function
        }
    } catch {
        Write-Host "❌ Error deploying $function : $_" -ForegroundColor Red
        $failed += $function
    }
    
    Write-Host ""
}

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Successfully deployed: $($deployed.Count)" -ForegroundColor Green
foreach ($func in $deployed) {
    Write-Host "   - $func" -ForegroundColor Green
}

if ($failed.Count -gt 0) {
    Write-Host "❌ Failed to deploy: $($failed.Count)" -ForegroundColor Red
    foreach ($func in $failed) {
        Write-Host "   - $func" -ForegroundColor Red
    }
} else {
    Write-Host "🎉 All functions deployed successfully!" -ForegroundColor Green
}

Write-Host ""

