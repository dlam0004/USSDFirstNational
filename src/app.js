// TODO: the full flow — dial → menu → ticket creation → SR number → email to support — is working end to end, tested with a real SendGrid account 
// and a real email delivered. Everything's driven by placeholders in .env (APP_NAME, COMPANY_CODE, SUPPORT_EMAIL, SENDGRID_FROM_EMAIL), so swapping in the client's real values later is a config change, not a code change.


const express = require('express');
const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const ussdController = require('./ussd/controller');
const comvivaController = require('./ussd/comvivaController');

const app = express();

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(requestLogger);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: config.env, sessionStore: config.sessionStoreType });
});

app.post('/ussd', ussdController.handle);
app.post('/ussd/comviva', comvivaController.handle);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

module.exports = app;
