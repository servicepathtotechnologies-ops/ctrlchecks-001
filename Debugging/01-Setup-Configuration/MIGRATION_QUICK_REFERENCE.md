# 🚀 Supabase Account Migration - Quick Reference

Quick checklist for migrating to a new Supabase account.

## ⚡ Fast Track (No Data Migration)

### 1. New Account Setup (5 min)
```
1. Create new Supabase project
2. Copy new credentials:
   - Project URL → VITE_SUPABASE_URL
   - anon key → VITE_SUPABASE_PUBLISHABLE_KEY
```

### 2. Run Migrations (10 min)
```
In new Supabase SQL Editor, run in order:
✅ 01_database_setup.sql
✅ 02_agent_memory_tables.sql
✅ 03_google_oauth_tokens.sql
✅ 04_form_trigger_setup.sql
✅ 05_role_based_templates.sql
✅ 06_update_signup_role_handling.sql
✅ 10_fix_user_roles_rls.sql
✅ 11_fix_security_issues.sql
✅ 07_sample_data.sql (optional)
```

### 3. Deploy Functions (10 min)
```bash
# Option A: Use deployment script
.\deploy-functions.ps1  # Windows
./deploy-functions.sh   # Linux/Mac

# Option B: Manual deployment
# Go to Dashboard → Edge Functions → Deploy each function
```

### 4. Set Secrets (2 min)
```
Dashboard → Edge Functions → Secrets:
✅ HUGGINGFACE_API_KEY = your_key
```

### 5. Update Environment (2 min)
```env
# Update .env file:
VITE_SUPABASE_URL=https://new-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=new-anon-key
```

### 6. Test (5 min)
```
✅ User signup/login
✅ Create workflow
✅ Execute workflow
✅ Form trigger
✅ Webhook trigger
```

**Total Time: ~35 minutes**

---

## 📋 Full Checklist

### Pre-Migration
- [ ] Access to old Supabase account
- [ ] Access to new Supabase account
- [ ] Backup of important data (if needed)

### New Account Setup
- [ ] Create new Supabase project
- [ ] Save database password securely
- [ ] Copy Project URL
- [ ] Copy anon public key
- [ ] Copy service_role key (save securely)

### Database Migration
- [ ] Run `01_database_setup.sql`
- [ ] Run `02_agent_memory_tables.sql`
- [ ] Run `03_google_oauth_tokens.sql`
- [ ] Run `04_form_trigger_setup.sql`
- [ ] Run `05_role_based_templates.sql`
- [ ] Run `06_update_signup_role_handling.sql`
- [ ] Run `10_fix_user_roles_rls.sql`
- [ ] Run `11_fix_security_issues.sql`
- [ ] Run `07_sample_data.sql` (optional)

### Edge Functions
- [ ] Deploy `execute-workflow`
- [ ] Deploy `execute-agent`
- [ ] Deploy `execute-multimodal-agent`
- [ ] Deploy `generate-workflow`
- [ ] Deploy `chat-api`
- [ ] Deploy `chatbot`
- [ ] Deploy `form-trigger`
- [ ] Deploy `webhook-trigger`
- [ ] Deploy `admin-templates`
- [ ] Deploy `copy-template`
- [ ] Deploy `analyze-workflow-requirements`
- [ ] Deploy `build-multimodal-agent`

### Configuration
- [ ] Set `HUGGINGFACE_API_KEY` secret
- [ ] Set any other required secrets
- [ ] Update `.env` file
- [ ] Update deployment environment variables (if deployed)

### Verification
- [ ] Test user authentication
- [ ] Test workflow creation
- [ ] Test workflow execution
- [ ] Test form triggers
- [ ] Test webhook triggers
- [ ] Test AI agent features
- [ ] Verify RLS policies
- [ ] Check Edge Function logs

### Security
- [ ] Remove old credentials from code
- [ ] Verify `.env` is in `.gitignore`
- [ ] Check RLS is enabled on all tables
- [ ] Verify secrets are set correctly

---

## 🔑 Key Files to Update

### Environment Variables
```
.env (root directory)
├── VITE_SUPABASE_URL
└── VITE_SUPABASE_PUBLISHABLE_KEY
```

### Code Files (usually auto-configured)
```
src/integrations/supabase/client.ts
└── Uses env vars automatically ✅
```

### Deployment Platforms
```
Vercel/Netlify/etc.
├── Environment Variables
└── Update VITE_SUPABASE_URL
    └── Update VITE_SUPABASE_PUBLISHABLE_KEY
```

---

## 🆘 Common Issues

| Issue | Quick Fix |
|-------|-----------|
| Functions not found | Deploy all Edge Functions |
| RLS violation | Check policies are created |
| Extension missing | Run: `CREATE EXTENSION vector;` |
| Env vars not loading | Restart dev server |
| Foreign key errors | Import tables in order |

---

## 📞 Migration Order Summary

```
1. Create New Project
   ↓
2. Run SQL Migrations (01-11)
   ↓
3. Deploy Edge Functions
   ↓
4. Set Secrets
   ↓
5. Update .env
   ↓
6. Test Everything
   ↓
7. Update Deployment (if applicable)
```

---

## ⏱️ Time Estimates

| Task | Time |
|------|------|
| Create new project | 5 min |
| Run migrations | 10 min |
| Deploy functions | 10 min |
| Set secrets | 2 min |
| Update env vars | 2 min |
| Testing | 10 min |
| **Total** | **~40 min** |

---

## 📚 Full Documentation

For detailed instructions, see:
- `MIGRATE_SUPABASE_ACCOUNT.md` - Complete guide with all details

---

**Pro Tip:** Keep old account active for 1-2 weeks as backup, then delete it once everything is verified working! 🎯

