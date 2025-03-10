
// The following tests are run monthly because these can be long running tests or ones the check for future changes
// won't affect the setup-sqlite action.

const { find } = require('@actions/tool-cache')
const { setup_sqlite, cleanup } = require('../src/setup')
const hc = require('@actions/http-client')
const { setup_runner_temp_and_cache } = require('./utils')

// Set test limit to 60 minutes
jest.setTimeout(3600000)

const url_prefix = 'https://www.sqlite.org/'

async function execute(version, year) {
   // execute setup_sqlite intallation
   return setup_sqlite(version, year, url_prefix).finally(
      // run the cleanup callbacks
      cleanup
   )
}

describe('Monthly Tests', () => {
    const cleanup_cache_and_temp = setup_runner_temp_and_cache('MONTHLY')

    // Delete the TEMP and CACHE directory before and/or after executing the tests
    beforeAll(cleanup_cache_and_temp)
    afterAll(cleanup_cache_and_temp)

    describe('Latest SQLite Version Test', () => {
        // install the latest version to determine if the current implementation functions correctly
        test('Latest SQLite Version Test', async () => {
            // execute setup_sqlite intallation and then run the cleanup callbacks
            await execute(undefined, undefined)
        })
    })

    describe('Retry Count Test', () => {
        let timeout = 60000

        beforeEach(async () => {
            // create the release url
            const tag = 'https://api.github.com/repos/sqlite/sqlite/git/ref/tags/version-3.47.2'

            // Create a client connection
            const client = new hc.HttpClient(`github-sqlite-version-3.47.2-tag`)

            // Loop through a simple GitHub REST API call until it reaches a rate limit
            while (true) {
                // retrieve a list of tags
                let res = await client.get(tag)

                // eat the rest of the input information so that no memory leak will be generated
                res.message.resume()

                if (res.message.statusCode === 403 && res.message.headers['retry-after']) {
                    // Get the minimum amount of seconds that one should wait before trying again.
                    const secondsToWait = Number(res.message.headers['retry-after'])

                    timeout = ( secondsToWait + 5 ) * 1000 // convert seconds into milliseconds

                    break
                } else if (res.message.statusCode === 403 && res.message.headers['x-ratelimit-remaining'] === '0') {
                     // Get the ratelimit reset date in utc epoch seconds
                    const resetTimeEpochSeconds = res.message.headers['x-ratelimit-reset'];

                    // Get the current utc time in epoch seconds
                    const currentTimeEpochSeconds = Math.floor(Date.now() / 1000);

                    // Determine the minimum amount of seconds that one should wait before trying again.
                    const secondsToWait = resetTimeEpochSeconds - currentTimeEpochSeconds;

                    timeout = ( secondsToWait + 5 ) * 1000 // convert seconds into milliseconds

                    break
                } else if (res.message.statusCode != 200) {
                    throw new Error(`An unknown status code was generated: ${res.message?.statusCode}`)
                }
            }

            // should I determine that the timeout was updated?
            expect(timeout != 60000)
        }, 60000)

        test('Rate Limit Reached Test', async () => {
            const version = '3.47.1'

            // execute setup_sqlite intallation and then run the cleanup callbacks
            await execute(version, '2024')

            // Check that the sqlite version has been cached
            expect(find('sqlite', version)).not.toBe('')
        }, timeout)
    })
})
