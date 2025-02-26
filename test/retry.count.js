/*
 * The following set of tests will be testing the different combinations of
 * setting the retry count for the setup-sqlite action.
 */

const core = require('@actions/core')
const { setup_runner_temp_and_cache, set_input } = require('./utils')

const url_prefix = 'https://www.sqlite.org/'

function expected(value, default_value) {
    value = Number(value)
    if (Number.isInteger(value) && value > 0) {
        return value
    }
    return default_value
}

module.exports.execute_retry_count_test = (retry_count, version, year, directory) => {
    const cleanup_cache_and_temp = setup_runner_temp_and_cache( directory )

    describe(`.retry-count(${retry_count}, ${version}, ${year})`, () => {

        // Delete the TEMP and CACHE directory before and/or after executing the tests
        beforeAll(cleanup_cache_and_temp)
        afterAll(cleanup_cache_and_temp)

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

            const { setup_sqlite, cleanup, default_retry_count, max_retry_count } = require('../src/setup')

            // Execute the setup_sqlite action
            await setup_sqlite(version, year, url_prefix).finally(
                // run the cleanup callbacks
                cleanup
            )

            // Check that the max_retry_count was correctly set
            expect(max_retry_count).toBe(expected(retry_count, default_retry_count))
        })

    })
}
