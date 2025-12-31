#!/bin/bash

# Deploy All Supabase Edge Functions
# This script deploys all edge functions to your Supabase project

PROJECT_REF="nvrrqvlqnnvlihtlgmzn"

echo "🚀 Starting deployment of all Supabase Edge Functions..."
echo "Project Ref: $PROJECT_REF"
echo ""

# List of all functions to deploy
FUNCTIONS=(
  "admin-templates"
  "analyze-workflow-requirements"
  "chat-api"
  "chatbot"
  "copy-template"
  "execute-agent"
  "execute-workflow"
  "form-trigger"
  "generate-workflow"
  "webhook-trigger"
)

# Deploy each function
for func in "${FUNCTIONS[@]}"; do
  echo "📦 Deploying $func..."
  npx supabase functions deploy "$func" --project-ref "$PROJECT_REF"
  
  if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed $func"
  else
    echo "❌ Failed to deploy $func"
    exit 1
  fi
  echo ""
done

echo "🎉 All functions deployed successfully!"

