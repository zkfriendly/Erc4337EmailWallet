import { expect } from 'chai';
import request from 'supertest';
import quotedPrintable from 'quoted-printable';
import app from '../src/index'; // Adjust the import if necessary
import fs from 'fs';

describe('POST /signAndSend', () => {
  it("should pass with real email", async () => {
    const encodedBody = fs.readFileSync('test/emails/send.eml', 'utf8');
    const response = await request(app)
      .post('/signAndSend')
      .set('Content-Type', 'text/plain')
      .send(encodedBody);

    if (response.status !== 200) {
      console.error('Error:', response.text);
    }

    expect(response.status).to.equal(200);
    expect(response.text).to.equal('userOp extracted successfully');
  });

});