const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('ROOT OK'));
app.get('/api/test', (req, res) => res.send('API OK'));
app.listen(3001, () => console.log('DEBUG SERVER RUNNING ON 3001'));
