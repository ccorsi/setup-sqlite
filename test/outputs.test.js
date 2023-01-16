const fs = require('fs')
const path = require('path')
const { setup_sqlite, cleanup } = require('../src/setup')
const os = require('os')

const cachePath = path.join(__dirname, 'CACHE')
const tempPath =  path.join(__dirname, 'TEMP')

// Set temp and tool directories before importing (used to set global state)
process.env['RUNNER_TEMP']       = tempPath
process.env['RUNNER_TOOL_CACHE'] = cachePath

// Set the output file before running the setup action
const outputFile = path.join(__dirname, 'OUTPUT')

// Set the output file name to GITHUB_OUTPUT
process.env['GITHUB_OUTPUT']     = outputFile

// insure that we enough time to run these tests
jest.setTimeout(20000)

// Delete the TEMP and CACHE directory before executing the tests
beforeAll(() => {
	if (fs.existsSync(cachePath)) {
		fs.rmSync(cachePath, { recursive: true, force: true })
	}
	if (fs.existsSync(tempPath)) {
		fs.rmSync(tempPath, { recursive: true, force: true })
	}
})

beforeEach(() => {
    // Create the OUTPUT file
    fs.appendFileSync(outputFile, '', { encoding: 'utf8' } )
})

afterEach(() => {
    // Delete the OUTPUT file
    fs.rmSync(outputFile)
})

// This is the website that the sqlite will be downloaded from
const url_prefix = 'https://sqlite.org/'

function extract_entries(lines) {
    let entries = {}

    for(let idx = 0 ; idx < lines.length ; idx++) {
        let [ prop, sep ] = lines[idx++].split('<<')

        entries[prop] = ''

        while (idx < lines.length && lines[idx] != sep) {
            entries[prop] += lines[idx++];
        }
    }

    return entries
}

/**
 * This method will execute the setup sqlite action for the passed
 * version, year and sqlite website.  It will call the installation
 * and cleanup methods that the setup-sqlite action will perform.
 *
 * @param {string} version the version of sqlite to install
 * @param {string} year the release year of the sqlite to install
 * @param {string} url_prefix the website to download the sqlite version
 */
async function execute_setup(version, year, url_prefix) {
	// execute setup_sqlite intallation
	await setup_sqlite(version, year, url_prefix)

	// run the cleanup callbacks
	await cleanup()
}

/**
 * This method will perform the expected validations of the execution of the
 * setup-sqlite actions.  It will compare the passed version, cached hit and
 * sqlite bin directory to the ones that was stored within the output file.
 *
 * @param {strin} version the expected version of sqlite that was installed
 * @param {string} is_cached if the installed sqlite version was already cached
 * @param {bool} sqlite_bin_exists if the sqlite-bin exists
 */
function validate_setup(version, is_cached, sqlite_bin_exists) {
    // check that the different output properties have been set
    line = fs.readFileSync(outputFile).toString('utf8')

    let lines = line.split(os.EOL)

    let entries = extract_entries(lines)

    let sqlite_version = entries['sqlite-version']
    let cache_hit = entries['cache-hit']
    let sqlite_bin = entries['sqlite-bin']

    expect(sqlite_version).toBe(version)
    expect(cache_hit).toBe(is_cached)
    expect(fs.existsSync(sqlite_bin)).toBe(sqlite_bin_exists)
}

test('test cache-hit setting for installing a version multiple times', async () => {
    const version = '3.39.4'

    // initially install a particular version of sqlite
    await execute_setup(version, undefined, url_prefix)

    validate_setup(version, 'false', true)

    // install the same version of sqlite
    await execute_setup(version, undefined, url_prefix)

    // insure that the cached version was used
    validate_setup(version, 'true', true)
})

test('testing output settings', async () => {
    const version = '3.39.0'

    await execute_setup(version, undefined, url_prefix)

    validate_setup(version, 'false', true)
})

test('test cache-hit setting for installing different versions of sqlite', async () => {
    let version = '3.39.1'

    // install one version of sqlite
    await execute_setup(version, undefined, url_prefix)

    // insure that the cache hit was false
    validate_setup(version, 'false', true)

    version = '3.39.2'

    // install a different version of sqlite
    await execute_setup(version, undefined, url_prefix)

    // insure the the cache hit was false
    validate_setup(version, 'false', true)
})
