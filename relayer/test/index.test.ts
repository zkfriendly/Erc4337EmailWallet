import { expect } from 'chai';
import request from 'supertest';
import cheerio from 'cheerio';
import quotedPrintable from 'quoted-printable';
import app from '../src/index'; // Adjust the import if necessary
import fs from 'fs';

describe('POST /signAndSend', () => {
  it('should decode the quoted-printable email body and extract userOp', async () => {
    // Create a sample userOp object
    const userOp = { key: 'value' };
    const userOpHtml = `<div id="userOp">${JSON.stringify(userOp)}</div>`;
    const encodedBody = quotedPrintable.encode(userOpHtml);

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


  it('should return 400 if userOp div is not found', async () => {
    const invalidHtml = '<div id="otherDiv">Some content</div>';
    const encodedBody = quotedPrintable.encode(invalidHtml);

    const response = await request(app)
      .post('/signAndSend')
      .set('Content-Type', 'text/plain')
      .send(encodedBody);

    if (response.status !== 200) {
      console.error('Error:', response.text);
    }

    expect(response.status).to.equal(400);
    expect(response.text).to.equal('userOp not found in the email body');
  });

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