# ============================================
# Supabase Edge Functions Deployment Script
# ============================================
# This script deploys Supabase Edge Functions to your Supabase project
# 
# Usage:
#   .\deploy-functions.ps1                    # Deploy all functions
#   .\deploy-functions.ps1 -Function "form-trigger"  # Deploy specific function
#   .\deploy-functions.ps1 -Setup              # Setup login/link first
#   .\deploy-functions.ps1 -NoVerifyJWT        # Deploy without JWT verification
#
# Requirements:
#   - Node.js and npm installed
#   - Supabase CLI installed (or use npx)
#   - Logged in to Supabase (run with -Setup if not)
# ============================================

param(
    [string]$Function = "",           # Specific function to deploy (empty = all)
    [string]$ProjectRef = "",         # Supabase project reference ID
    [switch]$Setup,                   # Run setup (login + link)
    [switch]$NoVerifyJWT,             # Deploy without JWT verification
    [switch]$Help                     # Show help message
)

# ============================================
# CONFIGURATION
# ============================================

# List of all Supabase Edge Functions to deploy
$AllFunctions = @(
    "admin-templates",
    "analyze-workflow-requirements",
    "build-multimodal-agent",
    "chat-api",
    "chatbot",
    "copy-template",
    "execute-agent",
    "execute-multimodal-agent",
    "execute-workflow",
    "form-trigger",
    "generate-workflow",
    "webhook-trigger"
)

# ============================================
# HELPER FUNCTIONS
# ============================================

function Show-Help {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Supabase Edge Functions Deployment Script" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage Examples:" -ForegroundColor Yellow
    Write-Host "  .\deploy-functions.ps1" -ForegroundColor White
    Write-Host "    → Deploys all functions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\deploy-functions.ps1 -Function `"form-trigger`"" -ForegroundColor White
    Write-Host "    → Deploys only the form-trigger function" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\deploy-functions.ps1 -Setup" -ForegroundColor White
    Write-Host "    → Runs setup (login + link) then deploys all functions" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\deploy-functions.ps1 -NoVerifyJWT" -ForegroundColor White
    Write-Host "    → Deploys without JWT verification (for testing)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  .\deploy-functions.ps1 -ProjectRef `"your-project-ref`"" -ForegroundColor White
    Write-Host "    → Links to specific project before deploying" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Parameters:" -ForegroundColor Yellow
    Write-Host "  -Function      : Deploy specific function (default: all)" -ForegroundColor Gray
    Write-Host "  -ProjectRef    : Supabase project reference ID" -ForegroundColor Gray
    Write-Host "  -Setup         : Run login and link setup first" -ForegroundColor Gray
    Write-Host "  -NoVerifyJWT   : Skip JWT verification during deployment" -ForegroundColor Gray
    Write-Host "  -Help          : Show this help message" -ForegroundColor Gray
    Write-Host ""
    exit 0
}

function Setup-Supabase {
    Write-Host "🔧 Setting up Supabase connection..." -ForegroundColor Yellow
    Write-Host ""
    
    # Step 1: Login
    Write-Host "Step 1: Logging in to Supabase..." -ForegroundColor Cyan
    $loginResult = npx supabase@latest login 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed. Please check your credentials." -ForegroundColor Red
        return $false
    }
    Write-Host "✅ Login successful" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Link project
    if ($ProjectRef) {
        Write-Host "Step 2: Linking to project $ProjectRef..." -ForegroundColor Cyan
        $linkResult = npx supabase@latest link --project-ref $ProjectRef 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Project linking failed." -ForegroundColor Red
            return $false
        }
        Write-Host "✅ Project linked successfully" -ForegroundColor Green
    } else {
        Write-Host "Step 2: Linking to project (interactive)..." -ForegroundColor Cyan
        Write-Host "   (If you have a project-ref, use -ProjectRef parameter)" -ForegroundColor Gray
        $linkResult = npx supabase@latest link 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Project linking failed." -ForegroundColor Red
            return $false
        }
        Write-Host "✅ Project linked successfully" -ForegroundColor Green
    }
    Write-Host ""
    
    return $true
}

function Deploy-Function {
    param(
        [string]$FunctionName,
        [bool]$SkipJWT = $false
    )
    
    Write-Host "📦 Deploying $FunctionName..." -ForegroundColor Yellow
    
    try {
        # Build deployment command
        $deployCmd = "npx supabase@latest functions deploy $FunctionName"
        if ($SkipJWT) {
            $deployCmd = "npx supabase functions deploy $FunctionName --no-verify-jwt"
        }
        
        # Execute deployment
        $result = Invoke-Expression $deployCmd 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ $FunctionName deployed successfully" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ $FunctionName deployment failed" -ForegroundColor Red
            Write-Host $result -ForegroundColor Red
            return $false
        }
    } catch {
        Write-Host "❌ Error deploying $FunctionName : $_" -ForegroundColor Red
        return $false
    }
}

# ============================================
# MAIN SCRIPT
# ============================================

# Show help if requested
if ($Help) {
    Show-Help
}

# Determine which functions to deploy
$functionsToDeploy = @()
if ($Function) {
    if ($AllFunctions -contains $Function) {
        $functionsToDeploy = @($Function)
        Write-Host "🎯 Deploying single function: $Function" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Error: Function '$Function' not found in function list." -ForegroundColor Red
        Write-Host "Available functions: $($AllFunctions -join ', ')" -ForegroundColor Yellow
        exit 1
    }
} else {
    $functionsToDeploy = $AllFunctions
    Write-Host "🚀 Deploying All Supabase Edge Functions..." -ForegroundColor Green
}

Write-Host ""

# Run setup if requested
if ($Setup) {
    $setupSuccess = Setup-Supabase
    if (-not $setupSuccess) {
        Write-Host "❌ Setup failed. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Track deployment results
$deployed = @()
$failed = @()

# Deploy functions
foreach ($func in $functionsToDeploy) {
    $success = Deploy-Function -FunctionName $func -SkipJWT $NoVerifyJWT
    
    if ($success) {
        $deployed += $func
    } else {
        $failed += $func
    }
    
    Write-Host ""
}

# ============================================
# DEPLOYMENT SUMMARY
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Successfully deployed: $($deployed.Count)" -ForegroundColor Green
foreach ($func in $deployed) {
    Write-Host "   ✅ $func" -ForegroundColor Green
}

if ($failed.Count -gt 0) {
    Write-Host ""
    Write-Host "❌ Failed to deploy: $($failed.Count)" -ForegroundColor Red
    foreach ($func in $failed) {
        Write-Host "   ❌ $func" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "💡 Tip: Check error messages above for details." -ForegroundColor Yellow
    Write-Host "   You may need to:" -ForegroundColor Yellow
    Write-Host "   - Run with -Setup to login/link project" -ForegroundColor Gray
    Write-Host "   - Check your Supabase project configuration" -ForegroundColor Gray
    Write-Host "   - Verify function code is correct" -ForegroundColor Gray
    exit 1
} else {
    Write-Host ""
    Write-Host "🎉 All functions deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Next Steps:" -ForegroundColor Cyan
    Write-Host "   - Test your functions in Supabase Dashboard" -ForegroundColor Gray
    Write-Host "   - Check function logs for any runtime errors" -ForegroundColor Gray
    Write-Host "   - Update your frontend to use the deployed endpoints" -ForegroundColor Gray
    exit 0
}
