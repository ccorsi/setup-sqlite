/*
 * The following set of tests will be testing the different combinations of
 * setting the retry count for the setup-sqlite action.
 */

const { setup_sqlite, cleanup, default_retry_count, max_retry_count } = require('../src/setup')
const core = require('@actions/core')
const { existsSync, rmSync } = require('fs')
const path = require('path')

// Set test limit to 60 seconds
jest.setTimeout(60000)

const cachePath = path.join(__dirname, 'CACHE')
const tempPath =  path.join(__dirname, 'TEMP')

// Set temp and tool directories before importing (used to set global state)
process.env['RUNNER_TEMP']       = tempPath
process.env['RUNNER_TOOL_CACHE'] = cachePath

function cleanup_cache_and_temp() {
    if (existsSync(cachePath)) {
        rmSync(cachePath, { recursive: true, force: true })
    }
    if (existsSync(tempPath)) {
        rmSync(tempPath, { recursive: true, force: true })
    }
}

// Delete the TEMP and CACHE directory before and/or after executing the tests
beforeAll(cleanup_cache_and_temp)
afterAll( cleanup_cache_and_temp)

const url_prefix = 'https://www.sqlite.org/'

async function execute(version, year) {
   // execute setup_sqlite intallation
   return setup_sqlite(version, year, url_prefix).finally(
      // run the cleanup callbacks
      cleanup
   )
}

function set_input(name, value) {
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = String(value)
}

function expected(value) {
    if (Number.isInteger(value)) {
        value = Number(value)
        if (value < 0) {
            return default_retry_count
        }
        return value
    } else {
        return default_retry_count
    }
}

let input = [
    [ '1',   '3.48.0', '2025' ],
    [ '0',   '3.47.2', '2024' ],
    [ '-11', '3.47.1', '2024' ],
    [ 'a',   '3.47.0', '2024' ],
    [ '3',   '3.46.1', '2024' ],
    [ '',    '3.46.0', '2024' ]
]

describe.each(input)('.retry-count(%s)', (retry_count, version, year) => {

    beforeEach(() => {
        // Set the sqlite-retry-count input to value
        set_input('sqlite-retry-count', retry_count)
    })

    afterEach(() => {
        // Unset the sqlite-retry-count input
        set_input('sqlite-retry-count', '')
    })

    test(`.retry-count(${retry_count})`, async () => {
        // Insure that the sqlite-retry-count input was correctly set
        expect(core.getInput('sqlite-retry-count')).toBe(retry_count)

        // Execute the setup_sqlite action
        await execute(version, year, url_prefix)

        // Check that the max_retry_count was correctly set
        expect(max_retry_count).toBe(expected(retry_count))
    })

})
