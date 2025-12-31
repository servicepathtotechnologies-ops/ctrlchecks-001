# Debugging Documentation

This folder contains all debugging, implementation, and setup documentation organized by category.

## 📁 Folder Structure

### 01-Setup-Configuration
Setup guides and configuration documentation:
- **API_KEYS_SETUP_GUIDE.md** - Guide for setting up API keys (HuggingFace, Replicate, Groq)
- **INSTALL_SUPABASE_CLI.md** - Instructions for installing Supabase CLI on Windows

### 02-Deployment
All deployment-related guides:
- **DEPLOYMENT_GUIDE.md** - General Supabase Edge Functions deployment guide
- **MULTIMODAL_DEPLOYMENT_STEPS.md** - Specific deployment steps for Multimodal Agent Builder
- **DEPLOY_VIA_DASHBOARD.md** - Deploying functions via Supabase Dashboard
- **DEPLOY_FORM_TRIGGER_FUNCTION.md** - Form trigger function deployment guide

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

#### AI-Agent
- **AI_AGENT_WORKFLOW_GENERATION.md** - AI agent workflow generation
- **AUTONOMOUS_AGENT_IMPLEMENTATION.md** - Autonomous agent implementation details

### 05-Testing-Debugging
Testing and debugging guides:
- **CHECK_SUPABASE_LOGS.md** - How to check Supabase function logs
- **VERIFY_MODEL_WORKING.md** - How to verify models are working
- **WORKFLOW_VERIFICATION_GUIDE.md** - Workflow verification guide
- **WORKFLOW_ERROR_FIXES.md** - Common workflow error fixes
- **NODE_TESTING_GUIDE.md** - Complete node testing guide
- **testing_templates/** - Template testing documentation

### 06-Database
Database setup and migration guides:
- **DATABASE_SETUP_FORM_TRIGGER.md** - Database setup for form trigger
- **DATABASE_MIGRATION_FORM_TRIGGER.md** - Database migration for form trigger

### 07-Status-Reports
Implementation status and summary reports:
- **IMPLEMENTATION_SUMMARY.md** - Node quality improvements summary
- **FINAL_IMPLEMENTATION_STATUS.md** - Final node implementation status report

### 08-User-Guides
User-facing guides and FAQs:
- **USER_ACCESS_FAQ.md** - User access frequently asked questions
- **GIT_MERGE_STEPS.md** - Git merge workflow steps

## 🔍 Quick Navigation

**New to the project?** Start here:
1. `01-Setup-Configuration/API_KEYS_SETUP_GUIDE.md` - Set up API keys
2. `01-Setup-Configuration/INSTALL_SUPABASE_CLI.md` - Install Supabase CLI
3. `02-Deployment/DEPLOYMENT_GUIDE.md` - Deploy functions

**Implementing a node?** See:
1. `03-Node-Implementation/NODE_IMPLEMENTATION_README.md` - Implementation guide
2. `03-Node-Implementation/NODE_IMPLEMENTATION_EXAMPLE.md` - Example implementation
3. `05-Testing-Debugging/NODE_TESTING_GUIDE.md` - Testing guide

**Working on a specific feature?** Check:
- `04-Features/` - Feature-specific documentation organized by feature name

**Debugging issues?** See:
- `05-Testing-Debugging/CHECK_SUPABASE_LOGS.md` - Check logs
- `05-Testing-Debugging/WORKFLOW_ERROR_FIXES.md` - Common fixes

**Want to know current status?** Check:
- `07-Status-Reports/FINAL_IMPLEMENTATION_STATUS.md` - Overall status
- `07-Status-Reports/IMPLEMENTATION_SUMMARY.md` - Quality improvements

## 📝 Notes

- All documentation is in Markdown format (.md)
- Test configurations and data files are in JSON format
- Some features have subfolders with additional resources
- Documentation is organized by use case for easier navigation

