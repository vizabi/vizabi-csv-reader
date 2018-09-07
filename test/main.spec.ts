import * as fs from 'fs';
import * as path from 'path';
import * as chai from 'chai';
import { csvReaderObject } from '../src/index';

const expect = chai.expect;

global.d3 = require('d3');
global.Vizabi = require('vizabi');

const readText = (filePath, onFileRead) => {
  if (!fs.existsSync(filePath)) {
    return onFileRead('No such file: ' + filePath);
  }

  fs.readFile(filePath, 'utf-8', (err, content) => {
    if (err) {
      onFileRead(err);
      return;
    }

    onFileRead(null, content.toString());
  });
};

describe('excel reader object', () => {
  it('load data', async () => {

    const Foo = global.Vizabi.Reader.extend(csvReaderObject);
    const csvReaderObject2 = new Foo({
      path: path.resolve('test/fixtures/basic.csv'),
      additionalTextReader: readText
    });

    const res = await csvReaderObject2.load();

    expect(res.columns).to.deep.equal(['geo', 'time', 'GDP', 'LEX', 'POP', 'world_region', 'category']);
    expect(res.rows.length).to.equal(6600);
  });
});
