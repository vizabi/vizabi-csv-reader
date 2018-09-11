import * as parseDecimal from 'parse-decimal-number';

declare const d3;
declare const Vizabi;

const cached = {};

export const getReaderObject = () => ({

  _name: 'csv',

  /**
   * Initializes the reader.
   * @param {Object} readerInfo Information about the reader
   */
  init(readerInfo) {
    this._data = [];
    this._lastModified = readerInfo.lastModified || '';
    this._basepath = readerInfo.path;
    this.delimiter = readerInfo.delimiter;
    this.keySize = readerInfo.keySize || 1;
    this.assetsPath = readerInfo.assetsPath || '';
    this.additionalTextReader = readerInfo.additionalTextReader;
    this.additionalJsonReader = readerInfo.additionalJsonReader;

    this._parseStrategies = [
      ...[',.', '.,'].map(separator => this._createParseStrategy(separator)),
      numberPar => numberPar,
    ];

    Object.assign(this.ERRORS || {}, {
      WRONG_TIME_COLUMN_OR_UNITS: 'reader/error/wrongTimeUnitsOrColumn',
      NOT_ENOUGH_ROWS_IN_FILE: 'reader/error/notEnoughRows',
      UNDEFINED_DELIMITER: 'reader/error/undefinedDelimiter',
      EMPTY_HEADERS: 'reader/error/emptyHeaders',
      DIFFERENT_SEPARATORS: 'reader/error/differentSeparators',
      FILE_NOT_FOUND: 'reader/error/fileNotFoundOrPermissionsOrEmpty'
    });
  },

  ensureDataIsCorrect({columns, rows}, parsers) {
    const timeKey = columns[this.keySize];
    const [firstRow] = rows;
    const parser = parsers[timeKey];

    const time = firstRow[timeKey].trim();
    if (parser && !parser(time)) {
      throw this.error(this.ERRORS.WRONG_TIME_COLUMN_OR_UNITS, undefined, time);
    }

    if (!columns.filter(Boolean).length) {
      throw this.error(this.ERRORS.EMPTY_HEADERS);
    }
  },

  /**
   * This function returns info about the dataset
   * in case of CSV reader it's just the name of the file
   * @returns {object} object of info about the dataset
   */
  getDatasetInfo() {
    return {name: this._basepath.split('/').pop()};
  },

  getCached() {
    return cached;
  },

  load() {
    const {_basepath: path, _lastModified} = this;
    const cachedPromise = cached[path + _lastModified];

    return cachedPromise ? cachedPromise : cached[path + _lastModified] = new Promise((resolve, reject) => {
      let textReader = Vizabi.utils.d3text;

      if (this.additionalTextReader) {
        textReader = this.additionalTextReader;
      }

      textReader(path, (error, text) => {
        if (error) {
          error.name = this.ERRORS.FILE_NOT_FOUND;
          error.message = `No permissions, missing or empty file: ${path}`;
          error.endpoint = path;
          return reject(error);
        }

        try {
          const {delimiter = this._guessDelimiter(text)} = this;
          const parser = d3.dsvFormat(delimiter);
          const rows = parser.parse(text, row => Object.keys(row).every(key => !row[key]) ? null : row);
          const {columns} = rows;

          const result = {columns, rows};

          resolve(result);
        } catch (e) {
          return reject(e);
        }
      });
    });
  },

  getAsset(asset, options = {}) {
    const path = this.assetsPath + asset;

    let jsonReader = Vizabi.utils.d3json;

    if (this.additionalJsonReader) {
      jsonReader = this.additionalJsonReader;
    }

    return new Promise((resolve, reject) => {
      jsonReader(path, (error, text) => {
        if (error) {
          error.name = this.ERRORS.FILE_NOT_FOUND;
          error.message = `No permissions, missing or empty file: ${path}`;
          error.endpoint = path;
          return reject(error);
        }
        resolve(text);
      });
    });
  },

  _guessDelimiter(text) {
    const stringsToCheck = 2;
    const rows = this._getRows(text.replace(/"[^\r]*?"/g, ''), stringsToCheck);

    if (rows.length !== stringsToCheck) {
      throw this.error(this.ERRORS.NOT_ENOUGH_ROWS_IN_FILE);
    }

    const [header, firstRow] = rows;
    const [comma, semicolon] = [',', ';'];
    const commasCountInHeader = this._countCharsInLine(header, comma);
    const semicolonsCountInHeader = this._countCharsInLine(header, semicolon);
    const commasCountInFirstRow = this._countCharsInLine(firstRow, comma);
    const semicolonsCountInFirstRow = this._countCharsInLine(firstRow, semicolon);

    if (
      this._checkDelimiters(
        commasCountInHeader,
        commasCountInFirstRow,
        semicolonsCountInHeader,
        semicolonsCountInFirstRow
      )
    ) {
      return comma;
    } else if (
      this._checkDelimiters(
        semicolonsCountInHeader,
        semicolonsCountInFirstRow,
        commasCountInHeader,
        commasCountInFirstRow
      )
    ) {
      return semicolon;
    }

    throw this.error(this.ERRORS.UNDEFINED_DELIMITER);
  },

  _checkDelimiters(
    firstDelimiterInHeader,
    firstDelimiterInFirstRow,
    secondDelimiterInHeader,
    secondDelimiterInFirstRow
  ) {
    return firstDelimiterInHeader === firstDelimiterInFirstRow
      && firstDelimiterInHeader > 1
      && (
        (secondDelimiterInHeader !== secondDelimiterInFirstRow)
        || (!secondDelimiterInHeader && !secondDelimiterInFirstRow)
        || (firstDelimiterInHeader > secondDelimiterInHeader && firstDelimiterInFirstRow > secondDelimiterInFirstRow)
      );
  },

  _getRows(text, count = 0) {
    const re = /([^\r\n]+)/g;
    const rows = [];

    let rowsCount = 0;
    let matches;

    do {
      matches = re.exec(text);
      if (matches && matches.length > 1) {
        ++rowsCount;
        rows.push(matches[1]);
      }
    } while (matches && rowsCount !== count);

    return rows;
  },

  _countCharsInLine(text, char) {
    const re = new RegExp(char, 'g');
    const matches = text.match(re);
    return matches ? matches.length : 0;
  },

  _createParseStrategy(separators) {
    return value => {
      const hasOnlyNumbersOrSeparators = !(new RegExp(`[^-\\d${separators}]`).test(value));

      if (hasOnlyNumbersOrSeparators && value) {
        const result = parseDecimal(value, separators);

        if (!isFinite(result) || isNaN(result)) {
          this._isParseSuccessful = false;
        }

        return result;
      }

      return value;
    };
  },

  _mapRows(rows, query, parsers) {
    const mapRow = this._getRowMapper(query, parsers);
    this._failedParseStrategies = 0;
    for (const parseStrategy of this._parseStrategies) {
      this._parse = parseStrategy;
      this._isParseSuccessful = true;

      const result = [];
      for (const row of rows) {
        const parsed = mapRow(row);

        if (!this._isParseSuccessful) {
          this._failedParseStrategies++;
          break;
        }

        result.push(parsed);
      }

      if (this._isParseSuccessful) {
        if (this._failedParseStrategies === this._parseStrategies.length - 1) {
          throw this.error(this.ERRORS.DIFFERENT_SEPARATORS);
        }
        return result;
      }
    }
  },

  _onLoadError(error) {
    const {_basepath: path, _lastModified} = this;
    delete cached[path + _lastModified];

    this._super(error);
  }
});
