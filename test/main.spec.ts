import * as fs from 'fs';
import * as path from 'path';
import * as chai from 'chai';
import { csvReaderObject as csvReaderPlainObject } from '../src/index';

const expect = chai.expect;

global.d3 = require('d3');
global.Vizabi = require('vizabi');

const readText = (filePath, onFileRead) => {
  fs.stat(filePath, (fileErr, stat: any) => {
    if (fileErr) {
      return onFileRead(fileErr);
    }

    if (stat.code === 'ENOENT') {
      return onFileRead('No such file: ' + filePath);
    }

    fs.readFile(filePath, 'utf-8', (readErr, content) => {
      if (readErr) {
        return onFileRead(readErr);
      }

      onFileRead(null, content.toString());
    });
  });
};

const readJson = (filePath, onFileRead) => {
  readText(filePath, (err, textContent) => {
    if (err) {
      return onFileRead(err);
    }

    try {
      onFileRead(null, JSON.parse(textContent.toString()));
    } catch (e) {
      onFileRead(e);
    }
  });
};

describe('csv reader object', () => {
  it('load data', async () => {
    const expectedResult = require('./results/main.json');
    const CsvReader = global.Vizabi.Reader.extend(csvReaderPlainObject);
    const csvReaderObject = new CsvReader({
      path: path.resolve('test/fixtures/basic.csv'),
      additionalTextReader: readText
    });
    const result = await csvReaderObject.load();

    expect(result).to.deep.equal(expectedResult);
  });
  it('load assets', async () => {
    const expectedResult = require('./fixtures/world-50m.json');
    const CsvReader = global.Vizabi.Reader.extend(csvReaderPlainObject);
    const csvReaderObject = new CsvReader({
      assetsPath: path.resolve('test/fixtures/') + '/',
      additionalJsonReader: readJson
    });
    const result = await csvReaderObject.getAsset('world-50m.json');

    expect(result).to.deep.equal(expectedResult);
  });
});
