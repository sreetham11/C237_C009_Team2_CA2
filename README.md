# ResellVault

Reseller inventory system for trading cards, collectibles, and clothing — C237 Software Application Development, CA2 group project.

## How to run

1. Install dependencies:
   ```
   npm install
   ```
2. Open `app.js` and update the MySQL connection credentials to match your local setup:
   ```js
   const connection = mysql.createConnection({
       host: 'localhost',
       user: 'root',
       password: 'password',
       database: 'resellvault'
   });
   ```
3. Import the schema into MySQL (creates the `resellvault` database, tables, and some sample data):
   ```
   mysql -u root -p < schema.sql
   ```
   (or run the contents of `schema.sql` in MySQL Workbench / phpMyAdmin)
4. Start the server:
   ```
   node app.js
   ```
   or, with auto-restart on file changes:
   ```
   npx nodemon app.js
   ```
5. Visit `http://localhost:3000` — you should see the example product listing page.

## Project structure

- `app.js` — **all routes live here.** There are no separate `routes/` or `controllers/` folders, and no `express.Router()`. Each teammate adds their routes directly into this file at their marked `TODO` section, following the same `connection.query(sql, [params], (error, results) => { ... })` callback style as the example `GET /` route.
- `views/` — EJS templates.
- `public/images/` — uploaded product images (via multer). `public/` is served statically.
- `schema.sql` — database schema. Import this before running the app.

## Adding your routes

Find your name's `TODO` comment in `app.js` and add your GET/POST routes directly below it, in the same file. Match the existing style:

- `connection.query(sql, [params], (error, results) => { ... })` — callback style, not async/await or promises.
- `?` placeholders in SQL for any user-supplied values.
- On error: `console.error(error)` then `res.send('Error message')`.
- On success: `res.redirect('/')` or `res.render(...)` as appropriate.
- For routes that accept an uploaded image, use the existing `upload` (multer) middleware, e.g. `app.post('/addProduct', upload.single('image'), (req, res) => { ... })`.

## Login / sessions — not implemented yet

Our module hasn't covered login, authentication, or sessions yet (that's a later lesson), so:

- The `users` table exists in the schema (with a plain `password` column), but there is **no** login/register/session logic — no `bcrypt`, `express-session`, `jsonwebtoken`, or `passport`.
- Don't add any of that until it's been taught in class.
- In the meantime, to test ownership logic (e.g. "only the seller can edit their own product"), use the hardcoded placeholder already declared near the top of `app.js`:
  ```js
  const currentUserId = 1;
  ```
  Use this in place of a real logged-in user's ID until sessions are introduced.

## Notes

- An `orders` table is not in the schema yet — see the `TODO` in `schema.sql`. It'll be added once the team finalizes that part of the design.
- Uploaded images are saved to `public/images` using the original filename (`file.originalname`), matching the style taught in class.
