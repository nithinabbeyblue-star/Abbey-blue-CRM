# Login troubleshooting (can't sign in when you should)

If a user should have access but gets "Invalid email or password" or is sent to the waiting room:

## 1. Check user status in the database

The user must have **`status = 'ACTIVE'`** to sign in.

- **PENDING** + no password → they are sent to **Set password** (/activate).
- **PENDING** + has password → they see **Waiting for approval** until an admin approves.
- **SUSPENDED** → they see "Your account has been deactivated."
- **ACTIVE** + correct password → login succeeds.

To fix:

1. Open **Super Admin → Users** (or use Prisma Studio: `pnpm db:studio`).
2. Find the user by email.
3. Set **status** to **ACTIVE** if they are approved.
4. Ensure they have **set their password** (activate link or reset). Users created by Super Admin start as PENDING with no password; they must use the activation link to set one, then an admin sets status to ACTIVE.

## 2. Reset password for a user

If the user forgot their password or never set one:

- **Option A:** Super Admin can create a new user (they get an email with an activation link) or use the **activate** flow: user goes to `/activate?email=their@email.com` and sets a password (only works if status is PENDING and they have no password yet).
- **Option B:** Use a script or DB to set a new password hash. Example (run locally with access to DB):

```bash
pnpm exec tsx -e "
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('NEW_PASSWORD', 10);
console.log('Use this in Prisma Studio or SQL: update users set \\\"passwordHash\\\" = \\\"' + hash + '\\\" where email = \\\"user@example.com\\\";');
"
```

Then in Prisma Studio or SQL, set that user’s `passwordHash` and set `mustSetPassword` to `true` if you want them to change it on next login.

## 3. Development: see the real error

With `NODE_ENV=development`, the login page shows the actual error message (e.g. `CredentialsSignin`) when sign-in fails. Check that message and the server terminal for `[Auth] Login error:` to see the cause.
