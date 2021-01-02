const express = require('express');
const sgMail = require('@sendgrid/mail');
const uniqBy = require('lodash.uniqby');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const Redis = require('ioredis');
const { PETHARBOR_SPECIAL_NEEDS_DOGS_URL, PETHARBOR_DOMAIN } = require('./constants/petharbor');
const dogKeys = require('./constants/dogKeys');
const getCurrentISO = require('./utils/getCurrentISO');

const app = express();
const redis = new Redis(process.env.REDIS_URL);

app.get('/', (req, res) => {
  res.send('Bark bark, doggy-mon is running.');
});

app.listen(process.env.PORT, () => {
  console.log(`doggy-mon port ${process.env.PORT}`); // eslint-disable-line no-console
});

redis.set('previousDogs', JSON.stringify([]));
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const monitorDogs = async () => {
  const response = await fetch(PETHARBOR_SPECIAL_NEEDS_DOGS_URL);
  const $ = cheerio.load(await response.text());

  const tdMap = {
    0: dogKeys.IMAGE_URL,
    1: dogKeys.NAME,
    2: dogKeys.SEX,
    3: dogKeys.COLOR,
    4: dogKeys.BREED,
    5: dogKeys.AGE,
    7: dogKeys.DATE,
  };

  const currentDogs = [];

  $('.ResultsTable tr').each(function getCurrentDogs(trIndex) {
    if (trIndex === 0) return;

    const dog = {};

    $(this).find('td').each(function pushDog(i) {
      const key = tdMap[i];

      if (key === dogKeys.IMAGE_URL) {
        dog[dogKeys.IMAGE_URL] = `${PETHARBOR_DOMAIN}/${$(this).find('img').attr('src')}`;
        dog[dogKeys.ID] = (new URLSearchParams($(this).find('a').attr('href').split('?')[1])).get('ID');
        dog[dogKeys.URL] = `${PETHARBOR_DOMAIN}/pet.asp?uaid=SNJS.${dog[dogKeys.ID]}`;
      } else if (key === dogKeys.DATE) {
        dog[dogKeys.DATE] = $(this).find('span').text();
      } else if (key) {
        dog[key] = $(this).text();
      }
    });

    currentDogs.push(dog);
  });

  const jsonPreviousDogs = await redis.get('previousDogs');
  const previousDogs = JSON.parse(jsonPreviousDogs);

  const newDogs = currentDogs
    .filter((c) => !previousDogs.find((p) => p[dogKeys.ID] === c[dogKeys.ID]))
    .reverse();

  if (newDogs.length) {
    redis.set('previousDogs', JSON.stringify(currentDogs));
    const subject = `New Dogs: ${uniqBy(newDogs.map((dog) => dog[dogKeys.BREED]), (breed) => breed.toLowerCase()).join(' | ')}`;

    const html = newDogs
      .map((dog) => (`
        <p>
          <a href='${dog[dogKeys.URL]}'>
            <img src='${dog[dogKeys.IMAGE_URL]}' />
            <br />
            ${dog[dogKeys.NAME]}
          </a>
          ${['id', 'sex', 'color', 'breed', 'age', 'date'].map((key) => `<br /><b>${key}:</b> ${dog[key]}`).join('')}
          <br />
          <a href='mailto:SJAdopt@sanjoseca.gov?subject=${encodeURIComponent(`Interested in ${dog[dogKeys.ID]}`)}&body=${encodeURIComponent(`Hello, I am interested in ${dog[dogKeys.ID]}. Please let me know if I can meet him/her. Thank you!`)}'>Draft email</a>
        </p>
      `))
      .join('');

    const msg = {
      to: process.env.SENDGRID_TO_EMAIL,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      console.info(`${getCurrentISO()} - monitorDogs - email sent`); // eslint-disable-line no-console
    } catch (error) {
      console.error(`${getCurrentISO()} - monitorDogs - email error`); // eslint-disable-line no-console
      console.error(error); // eslint-disable-line no-console
    }
  }
};

const sendAppHealthEmail = async () => {
  const msg = {
    to: process.env.SENDGRID_TO_EMAIL,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: 'doggy-mon is running',
    text: 'EOM',
    html: 'EOM',
  };

  try {
    await sgMail.send(msg);
    console.info(`${getCurrentISO()} - sendAppHealthEmail - email sent`); // eslint-disable-line no-console
  } catch (error) {
    console.error(`${getCurrentISO()} - sendAppHealthEmail - email error`); // eslint-disable-line no-console
    console.error(error); // eslint-disable-line no-console
  }
};

monitorDogs();
setInterval(monitorDogs, process.env.DOG_EMAIL_INTERVAL_MILLISECONDS);
setInterval(sendAppHealthEmail, process.env.APP_HEALTH_EMAIL_INTERVAL_MILLISECONDS);
