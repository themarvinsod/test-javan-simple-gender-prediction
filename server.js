const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const Database = require('better-sqlite3');

const rootDir = __dirname;
const assetDir = path.join(rootDir, 'asset');
const connectionText = fs.readFileSync(path.join(assetDir, 'connection.txt'), 'utf8');
const connection = Object.fromEntries(
  connectionText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf(':');
      return separator < 0
        ? ['', '']
        : [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
    })
    .filter(([key, value]) => key && value)
);

if (connection.database_type !== 'sqlite' || !connection.database_name) {
  throw new Error('asset/connection.txt must specify database_type: sqlite and a database_name.');
}

const db = new Database(path.join(rootDir, `${connection.database_name}.db`));
db.pragma('foreign_keys = ON');
db.exec(fs.readFileSync(path.join(rootDir, 'schema.sql'), 'utf8'));

const countryData = JSON.parse(fs.readFileSync(path.join(assetDir, 'nations.json'), 'utf8'));
const countryNames = Object.fromEntries(
  Object.entries(countryData.data || {}).map(([countryId, country]) => [countryId, country.country])
);

const insertPrediction = db.prepare(`
  INSERT INTO predictions (
    name, gender_count, gender, gender_probability, nationality_count
  ) VALUES (
    @name, @genderCount, @gender, @genderProbability, @nationalityCount
  )
`);
const insertNationality = db.prepare(`
  INSERT INTO nationality_predictions (prediction_id, country_id, probability)
  VALUES (@predictionId, @countryId, @probability)
`);
const insertResult = db.transaction((result) => {
  const prediction = insertPrediction.run(result);
  for (const country of result.countries) {
    insertNationality.run({
      predictionId: prediction.lastInsertRowid,
      countryId: country.country_id,
      probability: country.probability
    });
  }
  return Number(prediction.lastInsertRowid);
});

const selectPredictions = db.prepare(`
  SELECT
    p.id,
    p.name,
    p.gender_count AS genderCount,
    p.gender,
    p.gender_probability AS genderProbability,
    p.nationality_count AS nationalityCount,
    p.created_at AS createdAt,
    n.country_id AS countryId,
    n.probability AS countryProbability
  FROM predictions p
  LEFT JOIN nationality_predictions n ON n.prediction_id = p.id
  WHERE p.id = ?
  ORDER BY n.probability DESC
`);

function getPrediction(id) {
  const rows = selectPredictions.all(id);
  if (rows.length === 0) return null;

  const first = rows[0];
  return {
    id: first.id,
    name: first.name,
    genderCount: first.genderCount,
    gender: first.gender,
    genderProbability: first.genderProbability,
    nationalityCount: first.nationalityCount,
    createdAt: first.createdAt,
    countries: rows
      .filter((row) => row.countryId !== null)
      .map((row) => ({
        countryId: row.countryId,
        country: countryNames[row.countryId] || row.countryId,
        probability: row.countryProbability
      }))
  };
}

function validCount(value) {
  return Number.isInteger(value) && value >= 0;
}

function validProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateResponses(genderData, nationalityData) {
  if (
    !genderData ||
    !validCount(genderData.count) ||
    !(genderData.gender === null || ['male', 'female'].includes(genderData.gender)) ||
    !(genderData.probability === null || validProbability(genderData.probability))
  ) {
    throw new Error('Genderize returned an unexpected response.');
  }
  if (
    !nationalityData ||
    !validCount(nationalityData.count) ||
    !Array.isArray(nationalityData.country) ||
    nationalityData.country.some(
      (country) =>
        !country ||
        typeof country.country_id !== 'string' ||
        !/^[A-Z]{2}$/.test(country.country_id) ||
        !validProbability(country.probability)
    )
  ) {
    throw new Error('Nationalize returned an unexpected response.');
  }
}

async function fetchPrediction(endpoint, name) {
  const url = new URL(endpoint);
  url.searchParams.set('name', name);
  const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new Error(`Prediction API returned HTTP ${response.status}.`);
  }
  return response.json();
}

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(rootDir, 'public')));

app.get('/api/predictions', (request, response) => {
  const ids = db.prepare('SELECT id FROM predictions ORDER BY id DESC LIMIT 10').all();
  response.json(ids.map(({ id }) => getPrediction(id)));
});

app.post('/api/predictions', async (request, response) => {
  const name = typeof request.body?.name === 'string' ? request.body.name.trim() : '';
  if (!name || name.length > 100) {
    return response.status(400).json({ error: 'Enter a name between 1 and 100 characters.' });
  }

  try {
    const [genderData, nationalityData] = await Promise.all([
      fetchPrediction('https://api.genderize.io/', name),
      fetchPrediction('https://api.nationalize.io/', name)
    ]);
    validateResponses(genderData, nationalityData);

    const id = insertResult({
      name,
      genderCount: genderData.count,
      gender: genderData.gender,
      genderProbability: genderData.probability,
      nationalityCount: nationalityData.count,
      countries: nationalityData.country
    });
    return response.status(201).json(getPrediction(id));
  } catch (error) {
    console.error('Could not create prediction:', error);
    return response.status(502).json({
      error: 'Could not get a prediction right now. Please try again.'
    });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Name predictor is running at http://localhost:${port}`);
});
