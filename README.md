# Vizabi CSV reader

## Install

```
npm i vizabi-csv-reader
```

## Usage

### Usage on backend

```
const Vizabi = require('vizabi');
const csvReader = require('vizabi-csv-reader');
Vizabi.Reader.extend('csv-reader', csvReader.csvReaderObject);
// ...
```

### Usage on frontend

```
<script src="node_modules/vizabi-csv-reader/dist/vizabi-csv-reader.js"></script>
<script>
  // CsvReader was imported by script above
  Vizabi.Reader.extend("csv-reader", CsvReader.csvReaderObject);
</script>
```

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
