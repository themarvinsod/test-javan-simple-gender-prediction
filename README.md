# Name insight

A small Node.js app that accepts a name, requests estimates from Genderize and Nationalize, and saves the results to SQLite.

## Run locally

1. Install SQLite.
2. Install Node.js 20 or newer.
3. From this folder, run `npm install`.
4. Run `npm start` and open <http://localhost:3000>.

The app reads the SQLite database type and name from `asset/connection.txt`, creates `test_javan.db` in the project folder, and applies `schema.sql` on startup. Name lookups are stored in `predictions`; their zero-or-more country estimates are stored in `nationality_predictions`.

Both prediction services must respond successfully for a lookup to be saved. The APIs return statistical estimates and should not be treated as facts about any person.
