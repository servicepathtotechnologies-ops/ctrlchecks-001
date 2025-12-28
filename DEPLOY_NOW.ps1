# Deploy Form Trigger Function
# Run this script in PowerShell from the project root

Write-Host "🚀 Deploying Form Trigger Function..." -ForegroundColor Green
Write-Host ""

# Step 1: Login (if not already logged in)
Write-Host "Step 1: Login to Supabase..." -ForegroundColor Yellow
npx supabase@latest login

# Step 2: Link project (if not already linked)
Write-Host ""
Write-Host "Step 2: Linking project..." -ForegroundColor Yellow
npx supabase@latest link --project-ref nvrrqvlqnnvlihtlgmzn

# Step 3: Deploy function
Write-Host ""
Write-Host "Step 3: Deploying form-trigger function..." -ForegroundColor Yellow
npx supabase@latest functions deploy form-trigger

Write-Host ""
Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Test your form URL:" -ForegroundColor Cyan
Write-Host "https://nvrrqvlqnnvlihtlgmzn.supabase.co/functions/v1/form-trigger/599a5dba-f3c1-45dc-b37b-4c6eaf1225ae/form_1766931020235" -ForegroundColor White

