const form = document.querySelector('#name-form');
const nameInput = document.querySelector('#name');
const submitButton = document.querySelector('#submit-button');
const statusMessage = document.querySelector('#status');
const resultContainer = document.querySelector('#latest-result');
const historyContainer = document.querySelector('#history');

function percentage(value) {
  return value === null || value === undefined ? 'Not available' : `${Math.round(value * 100)}%`;
}

function createCountryList(countries) {
  if (!countries.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'No country estimate available.';
    return empty;
  }

  const list = document.createElement('ul');
  list.className = 'country-list';
  for (const country of countries) {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const score = document.createElement('strong');
    label.textContent = country.country;
    score.textContent = percentage(country.probability);
    item.append(label, score);
    list.append(item);
  }
  return list;
}

function renderResult(prediction, target, compact = false) {
  target.replaceChildren();
  const heading = document.createElement(compact ? 'h3' : 'h2');
  heading.textContent = prediction.name;
  target.append(heading);

  const stats = document.createElement('div');
  stats.className = 'stats';
  const gender = document.createElement('div');
  gender.className = 'stat';
  const genderLabel = document.createElement('span');
  genderLabel.textContent = 'Gender estimate';
  const genderValue = document.createElement('strong');
  genderValue.textContent = prediction.gender
    ? `${prediction.gender[0].toUpperCase()}${prediction.gender.slice(1)} · ${percentage(prediction.genderProbability)}`
    : 'Not available';
  gender.append(genderLabel, genderValue);

  const nationality = document.createElement('div');
  nationality.className = 'stat country-stat';
  const nationalityLabel = document.createElement('span');
  nationalityLabel.textContent = 'Country estimates';
  nationality.append(nationalityLabel, createCountryList(prediction.countries));
  stats.append(gender, nationality);
  target.append(stats);

  if (!compact) {
    const sampled = document.createElement('p');
    sampled.className = 'sample-note';
    sampled.textContent = `Based on ${prediction.genderCount.toLocaleString()} gender records and ${prediction.nationalityCount.toLocaleString()} nationality records.`;
    target.append(sampled);
  }
}

function renderHistory(predictions) {
  historyContainer.replaceChildren();
  if (predictions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No lookups yet. Enter a name to get started.';
    historyContainer.append(empty);
    return;
  }

  for (const prediction of predictions) {
    const item = document.createElement('article');
    item.className = 'history-item';
    renderResult(prediction, item, true);
    historyContainer.append(item);
  }
}

async function loadHistory() {
  const response = await fetch('/api/predictions');
  if (!response.ok) throw new Error('Could not load saved lookups.');
  renderHistory(await response.json());
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  statusMessage.textContent = '';
  submitButton.disabled = true;
  submitButton.textContent = 'Looking it up…';

  try {
    const response = await fetch('/api/predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The lookup failed.');

    resultContainer.hidden = false;
    renderResult(result, resultContainer);
    statusMessage.textContent = 'Prediction saved to the database.';
    try {
      await loadHistory();
    } catch {
      statusMessage.textContent = 'Prediction saved, but recent lookups could not be refreshed.';
    }
  } catch (error) {
    statusMessage.textContent = error.message || 'Something went wrong. Please try again.';
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = 'Explore name <span aria-hidden="true">→</span>';
  }
});

loadHistory().catch((error) => {
  historyContainer.replaceChildren();
  const message = document.createElement('p');
  message.className = 'empty-state';
  message.textContent = error.message;
  historyContainer.append(message);
});
