import express, { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

app.post('/log', (req: Request, res: Response) => {
  const { largeString } = req.body;
  if (typeof largeString === 'string') {
    console.log(largeString);
    res.status(200).send('String logged successfully');
  } else {
    res.status(400).send('Invalid input');
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});