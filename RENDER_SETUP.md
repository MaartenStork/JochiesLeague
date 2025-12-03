# Setting up Supabase Database on Render

## Step 1: Get your Supabase Connection String

Your Supabase connection string format:
```
postgresql://postgres.lmbwqnvzxamanzecvmel:ColorPage2024!@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

To find your exact region:
1. Go to https://app.supabase.com/project/lmbwqnvzxamanzecvmel/settings/database
2. Under "Connection string" → "URI" (Session pooler)
3. Copy the full connection string

Common regions:
- US East: `aws-0-us-east-1.pooler.supabase.com`
- EU West: `aws-0-eu-west-1.pooler.supabase.com`
- AP Southeast: `aws-0-ap-southeast-1.pooler.supabase.com`

## Step 2: Set Environment Variables on Render

1. Go to your Render dashboard: https://dashboard.render.com/
2. Click on your backend service (Flask app)
3. Go to **Environment** tab
4. Add/Update the `DATABASE_URL` variable:
   ```
   DATABASE_URL=postgresql://postgres.lmbwqnvzxamanzecvmel:ColorPage2024!@aws-0-[YOUR-REGION].pooler.supabase.com:6543/postgres
   ```
   (Replace `[YOUR-REGION]` with your actual region from Step 1)

5. Make sure you also have:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `SECRET_KEY`
   - `FRONTEND_URL`

6. Click **Save Changes** - Render will automatically redeploy

## Step 3: Verify Setup

After deployment:
1. Check Render logs to ensure no database connection errors
2. Go to Supabase Table Editor: https://app.supabase.com/project/lmbwqnvzxamanzecvmel/editor
3. You should see `users` and `checkins` tables created automatically
4. Test a check-in from your frontend - it should appear in Supabase!

## Viewing Your Data

**Supabase Dashboard**: https://app.supabase.com/project/lmbwqnvzxamanzecvmel/editor
- Click "Table Editor" to see all records
- Click "SQL Editor" to run custom queries
- Click "Database" for performance metrics

## Local Development

For local testing, create a `.env` file in the `backend/` folder:
```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SECRET_KEY=your-secret-key
DATABASE_URL=postgresql://postgres.lmbwqnvzxamanzecvmel:ColorPage2024!@aws-0-[YOUR-REGION].pooler.supabase.com:6543/postgres
FRONTEND_URL=http://localhost:3000
```

Now your local dev will also use Supabase (same database as production)!

