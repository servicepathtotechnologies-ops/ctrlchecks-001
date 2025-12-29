# PowerShell script to deploy all Supabase Edge Functions
# Run this script from the ctrlchecks-001 directory

Write-Host "Deploying all Supabase Edge Functions..." -ForegroundColor Cyan
Write-Host ""

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

$successCount = 0
$failCount = 0

foreach ($func in $functions) {
    Write-Host "Deploying $func..." -ForegroundColor Yellow
    
    try {
        npx supabase functions deploy $func --no-verify-jwt
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Successfully deployed $func" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "Failed to deploy $func" -ForegroundColor Red
            $failCount++
        }
    } catch {
        Write-Host "Error deploying $func : $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary:" -ForegroundColor Cyan
Write-Host "  Successful: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor Red
Write-Host "========================================" -ForegroundColor Cyan

if ($failCount -eq 0) {
    Write-Host "All functions deployed successfully!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some functions failed to deploy. Please check the errors above." -ForegroundColor Yellow
    exit 1
}

