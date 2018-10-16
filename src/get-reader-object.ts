import * as parseDecimal from 'parse-decimal-number';

declare const d3;
declare const Vizabi;

const cached = {};
const GOOGLE_DOC_PREFIX = 'https://docs.google.com/spreadsheets/';

export interface IResult {
  columns: string[];
  rows: any[];
}

export const getReaderObject = () => ({
  MISSED_INDICATOR_NAME: 'indicator',
  _name: 'csv',

  /**
   * Initializes the reader.
   * @param {Object} readerInfo Information about the reader
   */
  init(readerInfo) {
    this._lastModified = readerInfo.lastModified || '';
    this._basepath = readerInfo.path;
    this.delimiter = readerInfo.delimiter;
    this.keySize = readerInfo.keySize || 1;
    this.hasNameColumn = readerInfo.hasNameColumn || false;
    this.nameColumnIndex = readerInfo.nameColumnIndex || 0;
    this.assetsPath = readerInfo.assetsPath || '';
    this.additionalTextReader = readerInfo.additionalTextReader;
    this.additionalJsonReader = readerInfo.additionalJsonReader;
    this.isTimeInColumns = readerInfo.timeInColumns || false;
    this.timeKey = 'time';

    // adjust _basepath if given a path to a google doc but without the correct export suffix. the first sheet is taken since none is specified
    if (this._basepath.includes(GOOGLE_DOC_PREFIX) && !this._basepath.includes('tqx=out:csv')) {
      const googleDocParsedUrl = this._basepath.split(GOOGLE_DOC_PREFIX)[1].split('/');
      const googleDocId = googleDocParsedUrl[googleDocParsedUrl.indexOf('d') + 1];
      this._basepath = GOOGLE_DOC_PREFIX + 'd/' + googleDocId + '/gviz/tq?tqx=out:csv'; // possible to add a default sheet like &sheet=data
    }

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
      FILE_NOT_FOUND: 'reader/error/fileNotFoundOrPermissionsOrEmpty',
      REPEATED_KEYS: 'reader/error/repeatedKeys'
    });
  },

  ensureDataIsCorrect({columns, rows}: IResult, parsers) {
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

  async load(parsers): Promise<IResult> {
    const cacheKey = `${this._name}${this._basepath}#${this._lastModified}#${this.isTimeInColumns}#${this.hasNameColumn}#${this.nameColumnIndex}`;
    const cachedPromise = cached[cacheKey];

    return cachedPromise ? cachedPromise : cached[cacheKey] = new Promise((resolve, reject) => {
      let textReader = Vizabi.utils.d3text;

      if (this.additionalTextReader) {
        textReader = this.additionalTextReader;
      }

      textReader(this._basepath, (error, text) => {
        if (error) {
          error.name = this.ERRORS.FILE_NOT_FOUND;
          error.message = `No permissions, missing or empty file: ${this._basepath}`;
          error.endpoint = this._basepath;
          return reject(error);
        }

        try {
          const {delimiter = this._guessDelimiter(text)} = this;
          const parser = d3.dsvFormat(delimiter);
          const rows = parser.parse(text, row => Object.keys(row).every(key => !row[key]) ? null : row);
          const {columns} = rows;

          // move column "name" so it goes after "time". turns [name, geo, gender, time, lex] into [geo, gender, time, name, lex]
          if (this.hasNameColumn) {
            columns.splice(this.keySize + 1, 0, columns.splice(this.nameColumnIndex, 1)[0]);
          }

          const transformer = this.isTimeInColumns ? this.timeInColumns.bind(this) : r => r;
          const result = transformer({columns, rows}, parsers);

          resolve(result);
        } catch (e) {
          return reject(e);
        }
      });
    });
  },

  timeInColumns({columns, rows}: IResult, parsers) {
    const keySize = this.keySize;

    let nameConcept = null;
    
    // remove column "name" as array's k+1 th element, but remember its header in a variable.
    // if it's an empty string, call it "name"
    // name column is not at its original index because it was moved by csv reader "load" method
    if (this.hasNameColumn) {
      nameConcept = columns.splice(keySize + 1, 1)[0] || 'name';
    }
    
    const missedIndicator = parsers && parsers[this.timeKey] && !!parsers[this.timeKey](columns[keySize]);

    if (missedIndicator) {
      Vizabi.utils.warn('Indicator column is missed.');
    }

    const indicatorKey = missedIndicator ? this.MISSED_INDICATOR_NAME : columns[keySize];
    const concepts = columns.slice(0, keySize)
      .concat(this.timeKey)
      .concat(nameConcept || [])
      .concat(missedIndicator ? Vizabi.utils.capitalize(this.MISSED_INDICATOR_NAME) : rows.reduce((result, row) => {
        const concept = row[indicatorKey];
        if (!result.includes(concept) && concept) {
          result.push(concept);
        }
        return result;
      }, []));

    const indicators = concepts.slice(keySize + 1 + (nameConcept ? 1 : 0));
    const [entityDomain] = concepts;

    return {
      columns: concepts,
      rows: rows.reduce((result, row) => {
        const rowEntityDomain = row[entityDomain];
        const resultRows = result.filter(resultRow => resultRow[entityDomain] === rowEntityDomain);

        if (resultRows.length) {
          if (resultRows[0][row[indicatorKey]] !== null) {
            throw this.error(this.ERRORS.REPEATED_KEYS, null, {
              indicator: row[indicatorKey],
              key: row[entityDomain]
            });
          }

          resultRows.forEach(resultRow => {
            resultRow[row[indicatorKey]] = row[resultRow[this.timeKey]];
          });
        } else {
          Object.keys(row).forEach(key => {
            if (![entityDomain, indicatorKey, nameConcept].includes(key)) {
              const domainAndTime = {
                [entityDomain]: row[entityDomain], 
                [this.timeKey]: key
              };
              const optionalNameColumn = !nameConcept ? {} : {
                [nameConcept]: row[nameConcept]
              };
              const indicatorsObject = indicators.reduce((indResult, indicator) => {
                indResult[indicator] = missedIndicator || row[indicatorKey] === indicator ? row[key] : null;
                return indResult;
              }, {});

              result.push(Object.assign(domainAndTime, optionalNameColumn, indicatorsObject));
            }
          });
        }

        return result;
      }, [])
    };
  },

  async getAsset(asset, options = {}) {
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
    delete cached[this._basepath + this._lastModified];

    this._super(error);
  }
});
