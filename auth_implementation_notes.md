# User Authentication Implementation Notes

## Completed Features

### 1. Login Modal
- **Sign in button** appears in the header navigation
- **Magic link login** - users enter email and receive a login link
- Modal shows "Sign in to Stratos Brain" with email input field
- "Send magic link" button triggers Supabase Auth OTP flow
- After sending, modal shows "Check your email" confirmation

### 2. Database Tables Created
- `user_profiles` - extends auth.users with display_name
- `user_preferences` - stores user preferences as JSONB (column layouts, etc.)
- `user_activity` - logs user actions for attribution

### 3. Row Level Security (RLS)
- All three tables have RLS enabled
- Users can only view/modify their own profiles and preferences
- Activity logging is permissive (anyone can insert, anyone can view)

### 4. Auto Profile Creation
- Trigger `on_auth_user_created` fires on new user signup
- Automatically creates `user_profiles` entry with email and display_name

### 5. React Hooks Created
- `useUserPreferences` - get/set/delete preferences with SWR caching
- `useUserActivity` - log activities and retrieve activity history
- `useAuth` (AuthContext) - manages auth state, sign in/out

### 6. UI Components
- `UserMenu` - shows Sign in button when logged out, user info when logged in
- Login modal with email input and magic link flow
- Logout button with tooltip

## Testing Status
- ✅ Login modal opens correctly
- ✅ Email input field visible
- ✅ Cancel and Send magic link buttons work
- ✅ Deployed to Vercel successfully

## Next Steps for Full Integration
1. Integrate `useUserPreferences` with column layout saving
2. Add activity logging to portfolio add/remove operations
3. Add activity logging to memo generation
4. Add activity logging to asset tagging/reviewing
