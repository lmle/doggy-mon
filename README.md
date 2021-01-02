# doggy-mon
doggy-mon monitors a list of dogs found on the PetHarbor.com website and sends an email when dogs are added to the list.

## Setup
```
cd doggy-mon
touch src/config.env
```

In `config.env`, add the following variables:
| Name | Type | Description |
| --- | --- | --- |
| PORT | Number | Port number that Express will listen to |
| SENDGRID_API_KEY | String | API key for Sendgrid |
| SENDGRID_TO_EMAIL | String | Email that will receive emails |
| SENDGRID_FROM_EMAIL | String | Email that sends emails. The email must be verified as a Sender Identity in SendGrid. |
| DOG_EMAIL_INTERVAL_MILLISECONDS | Number | Milliseconds between checking the list of dogs. An email is sent only when there are new dogs. |
| APP_HEALTH_EMAIL_INTERVAL_MILLISECONDS | Number | Milliseconds between sending an email to say the application is still running. |
| REDIS_URL | String | URL for Redis server (e.g. '//127.0.0.1:6379') |

```
npm i
brew services start redis
source src/config.env
node src/index.js
```

## Developer
* doggy-mon is deployed [here](https://doggy-mon.herokuapp.com/) via Heroku
