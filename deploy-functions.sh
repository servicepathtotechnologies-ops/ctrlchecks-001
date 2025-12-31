#!/bin/bash
# Bash script to deploy all Supabase Edge Functions
# Run this script from the ctrlchecks-001 directory

echo "🚀 Deploying all Supabase Edge Functions..."
echo ""

functions=(
    "admin-templates"
    "analyze-workflow-requirements"
    "build-multimodal-agent"
    "chat-api"
    "chatbot"
    "copy-template"
    "execute-agent"
    "execute-multimodal-agent"
    "execute-workflow"
    "form-trigger"
    "generate-workflow"
    "webhook-trigger"
)

success_count=0
fail_count=0

for func in "${functions[@]}"; do
    echo "📦 Deploying $func..."
    
    if npx supabase functions deploy "$func" --no-verify-jwt; then
        echo "✅ Successfully deployed $func"
        ((success_count++))
    else
        echo "❌ Failed to deploy $func"
        ((fail_count++))
    fi
    
    echo ""
done

echo "========================================"
echo "Deployment Summary:"
echo "  ✅ Successful: $success_count"
echo "  ❌ Failed: $fail_count"
echo "========================================"

if [ $fail_count -eq 0 ]; then
    echo "🎉 All functions deployed successfully!"
    exit 0
else
    echo "⚠️  Some functions failed to deploy. Please check the errors above."
    exit 1
fi

