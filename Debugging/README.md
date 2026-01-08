# Debugging Documentation

This folder contains all debugging, implementation, and setup documentation organized by category.

## 📁 Folder Structure

### 01-Setup-Configuration
Setup guides and configuration documentation:
- **API_KEYS_SETUP_GUIDE.md** - Guide for setting up API keys (HuggingFace, Replicate, Groq)
- **HUGGINGFACE_API_KEY_FIX.md** - Comprehensive guide for fixing HuggingFace API key 401 errors (Edge Functions & Python backend)
- **ENV_SETUP_GUIDE.md** - Environment variables setup guide (local development)
- **HOW_TO_RUN.md** - Complete guide on how to run the project locally
- **INSTALL_SUPABASE_CLI.md** - Instructions for installing Supabase CLI on Windows
- **QUICK_START.md** - Quick start guide
- **SETUP_AND_RUN_GUIDE.md** - Setup and run instructions
- **LOCAL_DEV_SETUP.md** - Local development setup
- **MODEL_TESTING_SETUP.md** - Model testing setup guide
- **FINAL_SETUP_STEPS.md** - Final setup steps
- **SUPABASE_406_ERROR_FIX.md** - Fix for Supabase 406 errors

### 02-Deployment
All deployment-related guides:
- **DEPLOYMENT_GUIDE.md** - General Supabase Edge Functions deployment guide
- **DEPLOYMENT_ENVIRONMENT_SETUP.md** - Environment setup for deployment
- **MULTIMODAL_DEPLOYMENT_STEPS.md** - Specific deployment steps for Multimodal Agent Builder
- **DEPLOY_FORM_TRIGGER_FUNCTION.md** - Form trigger function deployment guide
- **DEPLOY_FUNCTIONS.md** - Deploy functions guide

### 03-Node-Implementation
Node implementation guides, references, and configurations:
- **NODE_IMPLEMENTATION_README.md** - Main node implementation guide
- **NODE_IMPLEMENTATION_PROMPT.md** - Prompt template for node implementation
- **NODE_IMPLEMENTATION_EXAMPLE.md** - Example node implementation
- **NODE_IMPLEMENTATION_QUICK_REF.md** - Quick reference guide
- **NODE_IMPLEMENTATION_STATUS.md** - Current implementation status
- **NODE_LIBRARY_STRUCTURE.md** - Structure of the node library
- **NODE_PROPERTIES_GUIDE.md** - Guide to node properties
- **NODE_AUDIT_REPORT.md** - Node audit report
- **node-audit.json** - Node audit data (JSON)
- **authentication-nodes-test-configs.json** - Test configurations
- **Auth/** - Authentication node test files

### 04-Features
Feature-specific documentation organized by feature:

#### Form-Trigger
- **FORM_TRIGGER_IMPLEMENTATION.md** - Form trigger implementation details
- **FORM_NODE_TESTING_EXAMPLES.md** - Form node testing examples
- **HOW_TO_SUBMIT_FORM_INPUTS.md** - Guide for submitting form inputs

#### Google-Nodes
- **GOOGLE_NODES_IMPLEMENTATION_SUMMARY.md** - Implementation summary
- **GOOGLE_NODES_USER_MANUAL.md** - User manual for Google nodes

#### Telegram-Chatbot
- **TELEGRAM_CHATBOT_SETUP.md** - Telegram chatbot setup guide
- **TELEGRAM_CHATBOT_WORKFLOW.md** - Telegram chatbot workflow documentation

#### Multimodal-Agent
- **MULTIMODAL_AGENT_BUILDER_README.md** - Complete Multimodal Agent Builder documentation
- **QUICK_FIX_EXECUTION.md** - Quick fix for execution function
- **IMAGE_PROCESSING_IMPLEMENTATION.md** - Image processing implementation
- **TEXT_TO_IMAGE_SETUP.md** - Text to image setup guide
- **ARCHITECTURE_REFACTOR.md** - Architecture refactoring documentation

#### AI-Agent
- **AI_AGENT_WORKFLOW_GENERATION.md** - AI agent workflow generation
- **AUTONOMOUS_AGENT_IMPLEMENTATION.md** - Autonomous agent implementation details
- **TRAINING_SYSTEM.md** - Training system documentation
- **ENHANCED_TRAINING.md** - Enhanced training guide

### 05-Testing-Debugging
Testing and debugging guides:
- **QUICK_FIX_GUIDE.md** - Quick fixes for common errors (406, 400, 401, timeouts)
- **CHECK_SUPABASE_LOGS.md** - How to check Supabase function logs
- **VERIFY_MODEL_WORKING.md** - How to verify models are working
- **WORKFLOW_VERIFICATION_GUIDE.md** - Workflow verification guide
- **WORKFLOW_ERROR_FIXES.md** - Common workflow error fixes
- **WORKFLOW_GENERATION_FIXES.md** - Workflow generation architecture fixes
- **WORKFLOW_TEST_UI.md** - Workflow test UI guide
- **NODE_TESTING_GUIDE.md** - Complete node testing guide
- **MULTIMODAL_DEBUG_REPORT.md** - Multimodal debug report
- **MULTIMODAL_DEBUG_SUMMARY.md** - Multimodal debug summary
- **MULTIMODAL_MODELS_DEBUG_GUIDE.md** - Multimodal models debug guide
- **HUGGINGFACE_MIGRATION_TESTING_GUIDE.md** - HuggingFace migration testing guide
- **CRM_README.md** - CRM testing documentation
- **WHY_THIS_WORKS.md** - Architecture explanation
- **testing_templates/** - Template testing documentation

### 06-Database
Database setup and migration guides:
- **DATABASE_SETUP_FORM_TRIGGER.md** - Database setup for form trigger
- **DATABASE_MIGRATION_FORM_TRIGGER.md** - Database migration for form trigger

### 07-Status-Reports
Implementation status and summary reports:
- **FIXES_SUMMARY.md** - Critical fixes summary (timeouts, API changes)
- **HUGGINGFACE_MIGRATION_SUMMARY.md** - HuggingFace migration summary
- **Refactoring_Report.md** - Multi-agent tools integration refactoring report
- **IMPLEMENTATION_SUMMARY.md** - Node quality improvements summary
- **FINAL_IMPLEMENTATION_STATUS.md** - Final node implementation status report
- **CODE_REVIEW_SUMMARY.md** - Code review summary
- **FALLBACK_REMOVAL_COMPLETE.md** - Fallback removal completion report
- **MODEL_TESTING_SUMMARY.md** - Model testing summary

### 08-User-Guides
User-facing guides and FAQs:
- **USER_ACCESS_FAQ.md** - User access frequently asked questions
- **GIT_MERGE_STEPS.md** - Git merge workflow steps

## 🔍 Quick Navigation

**New to the project?** Start here:
1. `01-Setup-Configuration/HOW_TO_RUN.md` - How to run the project
2. `01-Setup-Configuration/API_KEYS_SETUP_GUIDE.md` - Set up API keys
3. `01-Setup-Configuration/INSTALL_SUPABASE_CLI.md` - Install Supabase CLI
4. `02-Deployment/DEPLOYMENT_GUIDE.md` - Deploy functions

**Getting 401 errors?**
- `01-Setup-Configuration/HUGGINGFACE_API_KEY_FIX.md` - Complete guide for fixing API key errors

**Implementing a node?** See:
1. `03-Node-Implementation/NODE_IMPLEMENTATION_README.md` - Implementation guide
2. `03-Node-Implementation/NODE_IMPLEMENTATION_EXAMPLE.md` - Example implementation
3. `05-Testing-Debugging/NODE_TESTING_GUIDE.md` - Testing guide

**Working on a specific feature?** Check:
- `04-Features/` - Feature-specific documentation organized by feature name

**Debugging issues?** See:
- `05-Testing-Debugging/QUICK_FIX_GUIDE.md` - Quick fixes for common errors
- `05-Testing-Debugging/CHECK_SUPABASE_LOGS.md` - Check logs
- `05-Testing-Debugging/WORKFLOW_ERROR_FIXES.md` - Common workflow fixes
- `05-Testing-Debugging/WORKFLOW_GENERATION_FIXES.md` - Workflow generation fixes

**Want to know current status?** Check:
- `07-Status-Reports/FINAL_IMPLEMENTATION_STATUS.md` - Overall status
- `07-Status-Reports/IMPLEMENTATION_SUMMARY.md` - Quality improvements
- `07-Status-Reports/FIXES_SUMMARY.md` - Recent fixes summary

## 📝 Notes

- All documentation is in Markdown format (.md)
- Test configurations and data files are in JSON format
- Some features have subfolders with additional resources
- Documentation is organized by use case for easier navigation
- Root-level markdown files have been moved to appropriate Debugging folders

## 🔄 Recent Changes

- **Moved root-level MD files** to appropriate Debugging folders
- **Merged duplicate files**: Combined `QUICK_FIX_HUGGINGFACE_KEY.md` and `FIX_API_KEY_401_ERROR.md` into `HUGGINGFACE_API_KEY_FIX.md`
- **Merged duplicate files**: Combined `SIMPLE_FIX_GUIDE.md` and `QUICK_FIX_STEPS.md` into `QUICK_FIX_GUIDE.md`
- **Removed duplicate**: `NODE_REFERENCE_FOR_AGENT.md` (duplicate of file in `supabase/functions/generate-workflow/`)
