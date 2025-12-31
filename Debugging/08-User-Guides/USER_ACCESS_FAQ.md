# User Access FAQ - Google Sign-In

## Can All Users Access Google Sign-In?

**Yes!** Once properly configured, **all users with Google accounts can sign in** to your app using Google OAuth.

## Quick Answer

✅ **All users can access** - No restrictions on who can use Google sign-in  
✅ **Automatic account creation** - Users are created automatically on first sign-in  
✅ **Default role assignment** - All users get "user" role by default  
✅ **No manual approval needed** - Users can sign in immediately  

## Important Configuration

### 1. OAuth Consent Screen Type

**Choose "External" (not "Internal")**

- ✅ **External** = Public access, anyone with Google account can sign in
- ❌ **Internal** = Only users in your Google Workspace organization

**Where to set this:**
- Google Cloud Console > APIs & Services > OAuth consent screen
- Select "External" when creating the consent screen

### 2. Publish Your App

**For Production Access:**
- Go to OAuth consent screen settings
- Click "Publish App" button
- This makes it available to all users (not just test users)

**Before Publishing (Testing):**
- Only test users you add can sign in
- Add test users in the OAuth consent screen configuration

## User Flow

### First-Time Google Sign-In

1. User clicks "Continue with Google"
2. Redirected to Google sign-in page
3. User signs in with their Google account
4. Google redirects back to your app
5. **Automatic account creation:**
   - User account created in Supabase `auth.users`
   - Profile created in `profiles` table
   - Default role "user" assigned in `user_roles` table
6. User is logged in and redirected to dashboard

### Subsequent Sign-Ins

1. User clicks "Continue with Google"
2. Google recognizes existing account
3. User is logged in immediately
4. Redirected to dashboard

## User Roles

### Default Role: "user"

All users signing in with Google automatically get:
- Role: `"user"` (default)
- Access to: Dashboard, Workflows, Templates
- Cannot access: Admin panel

### Making a User Admin

**Option 1: Via Supabase Dashboard**
1. Go to Table Editor > `user_roles`
2. Click "Insert row"
3. Enter:
   - `user_id`: Get from `auth.users` table
   - `role`: `admin`
4. Save

**Option 2: Via SQL**
```sql
-- Find user email first
SELECT id, email FROM auth.users WHERE email = 'user@example.com';

-- Add admin role
INSERT INTO public.user_roles (user_id, role)
VALUES ('user-uuid-from-above', 'admin');
```

**Option 3: Via Code (for initial setup)**
```typescript
// In your admin panel or setup script
await supabase
  .from('user_roles')
  .insert({ user_id: userId, role: 'admin' });
```

## Common Questions

### Q: Do I need to manually approve each user?
**A:** No! Users can sign in immediately. No approval needed.

### Q: Can I restrict who can sign in?
**A:** Yes, but you'd need to:
- Use "Internal" OAuth type (only Google Workspace users)
- Or add custom logic to check user email/domain after sign-in
- Or manually approve users by adding them to a whitelist table

### Q: What if a user signs in with email/password and then Google?
**A:** Supabase handles this - if the email matches, it links the accounts automatically.

### Q: Can users sign in with both methods?
**A:** Yes! Users can:
- Sign in with email/password
- Sign in with Google
- Both methods work for the same account (if email matches)

### Q: What information does Google provide?
**A:** With scopes `email`, `profile`, `openid`:
- Email address
- Full name
- Profile picture (avatar URL)
- Google user ID

### Q: Is there a user limit?
**A:** No! Google OAuth has no user limit. Your Supabase plan may have limits, but OAuth itself doesn't.

## Troubleshooting Access Issues

### User sees "Access Denied" or "App Not Verified"

**Solution:**
1. Make sure OAuth consent screen is **published**
2. If in testing, add user as a test user
3. Check that you selected "External" user type

### User can't sign in (redirects back without login)

**Solution:**
1. Check redirect URIs in Google Cloud Console
2. Verify Supabase callback URL is correct
3. Check browser console for errors

### User signs in but has no access

**Solution:**
1. Check `user_roles` table - user should have "user" role
2. Check `profiles` table - profile should be created
3. Verify database triggers are working

## Security Notes

- ✅ Users can only access their own data (enforced by RLS policies)
- ✅ Admin roles must be manually assigned
- ✅ All authentication is handled securely by Supabase
- ✅ OAuth tokens are managed automatically

## Need Help?

If users are having trouble accessing Google sign-in:
1. Check the setup guide: `GOOGLE_OAUTH_SETUP.md`
2. Verify OAuth consent screen is published
3. Check Supabase logs for errors
4. Verify redirect URIs are correct

