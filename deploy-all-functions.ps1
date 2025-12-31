# Deploy All Supabase Edge Functions (PowerShell)
# This script deploys all edge functions to your Supabase project

$PROJECT_REF = "nvrrqvlqnnvlihtlgmzn"

Write-Host "🚀 Starting deployment of all Supabase Edge Functions..." -ForegroundColor Cyan
Write-Host "Project Ref: $PROJECT_REF"
Write-Host ""

# List of all functions to deploy
$FUNCTIONS = @(
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

# Deploy each function
foreach ($func in $FUNCTIONS) {
  Write-Host "📦 Deploying $func..." -ForegroundColor Yellow
  npx supabase functions deploy $func --project-ref $PROJECT_REF
  
  if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Successfully deployed $func" -ForegroundColor Green
  } else {
    Write-Host "❌ Failed to deploy $func" -ForegroundColor Red
    exit 1
  }
  Write-Host ""
}

Write-Host "🎉 All functions deployed successfully!" -ForegroundColor Green

