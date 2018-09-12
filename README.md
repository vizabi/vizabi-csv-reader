# Vizabi CSV reader

The main goal of this repo is to provide ability for Vizabi to work with CSV data.

## Install

```
npm i vizabi-csv-reader
```

## Usage

### Usage on backend

```javascript
import * as fs from 'fs';
import * as path from 'path';
import { csvReaderObject as csvReaderPlainObject } from 'vizabi-csv-reader';

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

const CsvReader = global.Vizabi.Reader.extend(csvReaderPlainObject);
const csvReaderObject = new CsvReader({
  path: path.resolve('path to csv file'),
  additionalTextReader: readText
});
const result = await csvReaderObject.load();

console.log(result);
```

### Usage on frontend

```html
<script src="node_modules/vizabi-csv-reader/dist/vizabi-csv-reader.js"></script>
<script>
  // CsvReader was imported by script above
  Vizabi.Reader.extend("csv-reader", CsvReader.csvReaderObject);
  // use "csv-reader" as a Vizabi init parameter
  // .....
</script>
```

### Get assets on backend

```javascript
import * as fs from 'fs';
import * as path from 'path';
import { csvReaderObject as csvReaderPlainObject } from 'vizabi-csv-reader';

const expect = chai.expect;

global.d3 = require('d3');
global.Vizabi = require('vizabi');

const readJson = (filePath, onFileRead) => {
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

      try {
        onFileRead(null, JSON.parse(content.toString()));
      } catch (e) {
        onFileRead(e);
      }
    });
  });
};

const expectedResult = require('./fixtures/world-50m.json');
const CsvReader = global.Vizabi.Reader.extend(csvReaderPlainObject);
const csvReaderObject = new CsvReader({
  assetsPath: path.resolve('test/fixtures/') + '/',
  additionalJsonReader: readJson
});
const result = await csvReaderObject.getAsset('path to asset');

console.log(result);
```

### Initial parameters

* `path` - path to csv file that would be processed
* `lastModified` - last modification date (optional)
* `delimiter` - CSV delimiter character (optional)
* `keySize` - DDF key size (1 by default)
* `assetsPath` - path to assets JSON file (optional)
* `additionalTextReader` - function that should replace tenured text reading function 
                           (optional, see examples above, could be useful on frontend or testing) 
* `additionalJsonReader` - function that should replace tenured JSON reading function
                           (optional, see examples above, could be useful on frontend or testing)

### Run tests

```
npm test
```

## Build

```
git clone https://github.com/vizabi/vizabi-csv-reader.git
cd vizabi-csv-reader
npm i
npm run build
```

The result is a couple of directories: `dist` and `lib`.

`dist` contain two files: `vizabi-csv-reader.js` and `vizabi-csv-reader.js.map`. These files could be used
on frontend: see `Usage on frontend`

`lib` (`lib/index.js`) - is used 'by default' (see `main` section of `package.json`) and could be used on
backend (see `Usage on backend`)
