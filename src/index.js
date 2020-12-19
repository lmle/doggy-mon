const express = require('express');
const puppeteer = require('puppeteer');
const sgMail = require('@sendgrid/mail');
const uniqBy = require('lodash.uniqby');
const { PETHARBOR_SEARCH_URL, PETHARBOR_DOMAIN } = require('./constants/petharbor');
const dogKeys = require('./constants/dogKeys');
const getCurrentISO = require('./utils/getCurrentISO');
let previousDogs = [];
const app = express();

app.get('/', (req, res) => {
  res.send('Hey there, doggy-mon is running.');
});

app.listen(process.env.PORT, () => {
  console.log(`doggy-mon port ${process.env.PORT}`);
});

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const monitorDogs = async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.goto(PETHARBOR_SEARCH_URL);

  const currentDogs = await page.evaluate((keys, petharborDomain) => {
    const tdMap = {
      0: keys.IMAGE_URL,
      1: keys.NAME,
      2: keys.SEX,
      3: keys.COLOR,
      4: keys.BREED,
      5: keys.AGE,
      7: keys.DATE,
    };

    const dogs = [];

    $('.ResultsTable tr').each(function(trIndex) {
      if (trIndex === 0) return;

      const dog = {};

      $(this).find('td').each(function(i) {
        const key = tdMap[i];

        if (key === keys.IMAGE_URL) {
          dog[keys.IMAGE_URL] = `${petharborDomain}/${$(this).find('img').attr('src')}`;
          dog[keys.ID] = (new URLSearchParams($(this).find('a').attr('href').split('?')[1])).get('ID');
          dog[keys.URL] = `${petharborDomain}/pet.asp?uaid=SNJS.${dog[keys.ID]}`;
          return;
        }

        if (key === keys.DATE) {
          dog[keys.DATE] = $(this).find('span').text();
          return;
        }

        if (key) {
          dog[key] = $(this).text();
          return;
        }
      });

      dogs.push(dog);
    });

    return dogs;
  }, dogKeys, PETHARBOR_DOMAIN);

  const newDogs = currentDogs.filter((currentDog) => {
    return !previousDogs.find((previousDog) => previousDog[dogKeys.ID] === currentDog[dogKeys.ID]);
  });

  if (newDogs.length) {
    previousDogs = currentDogs;
    const subject = `New Dogs: ${uniqBy(newDogs.map((dog) => dog[dogKeys.BREED]), (breed) => breed.toLowerCase()).join(' | ')}`

    const html = newDogs.map((dog) => {
      return (
        `<p>` +
          `<img src='${dog[dogKeys.IMAGE_URL]}' />` +
          `<br />` +
          `<a href='${dog[dogKeys.URL]}'>${dog[dogKeys.NAME]}</a>` +
          ['id', 'sex', 'color', 'breed', 'age', 'date'].map((key) => `<br /><b>${key}:</b> ${dog[key]}`).join('') +
          `<br />` +
          `<a href='mailto:SJAdopt@sanjoseca.gov?subject=${encodeURIComponent(`Interested in ${dog[dogKeys.ID]}`)}&body=${encodeURIComponent(`Hello, I am interested in ${dog[dogKeys.ID]}. Please let me know if I can meet him/her. Thank you!`)}'>Send email</a>` +
        `</p>`
      );
    }).join('');

    const msg = {
      to: process.env.SENDGRID_TO_EMAIL,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject,
      html,
    };

    try {
      await sgMail.send(msg);
      console.info(`${getCurrentISO()} - monitorDogs - email sent`);
    } catch (error) {
      console.error(`${getCurrentISO()} - monitorDogs - email error`);
      console.error(error);
    }
  }

  await browser.close();
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
    console.info(`${getCurrentISO()} - sendAppHealthEmail - email sent`);
  } catch (error) {
    console.error(`${getCurrentISO()} - sendAppHealthEmail - email error`);
    console.error(error);
  }
};

monitorDogs();
setInterval(monitorDogs, process.env.DOG_EMAIL_INTERVAL_MILLISECONDS);

sendAppHealthEmail();
setInterval(sendAppHealthEmail, process.env.APP_HEALTH_EMAIL_INTERVAL_MILLISECONDS);