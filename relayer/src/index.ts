   import express from 'express';
   import dotenv from 'dotenv';
   import bodyParser from 'body-parser';

   // Load environment variables from .env file
   dotenv.config();

   const app = express();
   const port = process.env.PORT || 4000;

   // Custom middleware to handle text body regardless of content type
   app.use((req, res, next) => {
     let data = '';
     req.setEncoding('utf8');
     req.on('data', chunk => {
       data += chunk;
     });
     req.on('end', () => {
       req.body = data;
       next();
     });
   });

   // POST endpoint to receive a large string and log it
   app.post('/signAndSend', (req, res) => {
     const body = req.body;
     if (typeof body === 'string') {
       console.log(body);
       res.status(200).send('String logged successfully');
     } else {
       res.status(400).send('Invalid input');
     }
   });

   app.listen(port, () => {
     console.log(`Server is running on http://localhost:${port}`);
   });