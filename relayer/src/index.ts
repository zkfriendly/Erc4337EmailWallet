import express from 'express';
import dotenv from 'dotenv';
import quotedPrintable from 'quoted-printable';
import * as cheerio from 'cheerio';
import { eSign } from './prover/mock';
import { BigNumberish, BytesLike, ethers } from 'ethers';
import { sendUserOpAndWait } from './userOpUtils';

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
app.post('/signAndSend', async (req, res) => {
  const body = req.body;
  if (typeof body === 'string') {
    // Decode the quoted-printable email body
    const decodedBody = quotedPrintable.decode(body);

    // Parse the HTML to extract the userOp div content
    const $ = cheerio.load(decodedBody);
    const userOpDiv = $('[id$="userOp"]').html();

    if (userOpDiv) {
      try {
        const userOp = JSON.parse(userOpDiv);

        // now we need to sign the userOp by proving it using snarkjs
        const signature = await eSign({
          userOpHashIn: userOp.userOpHash,
          emailCommitmentIn: userOp.accountCode,
          pubkeyHashIn: "0x0"
        });

        console.log('signed userOp', signature);
        userOp.signature = signature;

        // now we need to send the userOp to the bundler
        await sendUserOpAndWait(userOp);  

        res.status(200).send('userOp extracted successfully');
      } catch (error) {
        if (error instanceof Error) {
          res.status(400).send(`Failed to parse userOp: ${error.message}`);
        } else {
          res.status(400).send('Failed to parse userOp: Unknown error');
        }
      }
    } else {
      res.status(400).send('userOp not found in the email body');
    }
  } else {
    res.status(400).send('Invalid input: body is not a string');
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

export default app;
