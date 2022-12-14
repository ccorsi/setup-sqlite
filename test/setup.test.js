/**
 * This test will determine that all of the passed distributions are still
 * accessicible from the major sqlite web site.
 */
const { find } = require('@actions/tool-cache')
const { existsSync, rmSync } = require('fs')
const path = require('path')
const { setup_sqlite, cleanup } = require('../src/setup')

/**
 * This is a list of all sqlite version that should still be accessible from
 * the sqlite web site.
 *
 * This information was retrieved from https://www.sqlite.org/chronology.html.
 */
const distributions = {
	2022: [ // '3.40.0', '3.39.4', '3.39.3', '3.39.2', '3.39.1', '3.39.0',
			// '3.38.5', '3.38.4', '3.38.3', '3.38.2', '3.38.1', '3.38.0',
			'3.37.2' ],
	2021: [ // '3.37.1', '3.37.0', '3.36.0', '3.35.5', '3.35.4', '3.35.3',
			/*'3.35.2', '3.35.1', '3.35.0',*/ '3.34.1' ],
	2020: [ // '3.34.0', '3.33.0', '3.32.3', '3.32.2', '3.32.1', '3.32.0',
			/*'3.31.1',*/ '3.31.0' ],
	2019: [ // '3.30.1', '3.30.0', '3.29.0', '3.28.0', '3.27.2', '3.27.1',
			'3.27.0' ],
	2018: [ // '3.26.0', '3.25.3', '3.25.2', '3.25.1', '3.25.0', '3.24.0',
			/* '3.23.1', '3.23.0', */ '3.22.0' ],
	2017: [ // '3.21.0', '3.20.1', '3.20.0', '3.19.3', '3.19.2', '3.19.1',
			// '3.19.0', '3.18.2', '3.18.1', '3.18.0', '3.17.0', '3.16.2',
			/*'3.16.1',*/ '3.16.0' ]
}

// Set test limit to 60 seconds
jest.setTimeout(60000)

const cachePath = path.join(__dirname, 'CACHE')
const tempPath =  path.join(__dirname, 'TEMP')

// Set temp and tool directories before importing (used to set global state)
process.env['RUNNER_TEMP']       = tempPath
process.env['RUNNER_TOOL_CACHE'] = cachePath

// Delete the TEMP and CACHE directory before executing the tests
beforeAll(() => {
	if (existsSync(cachePath)) {
		rmSync(cachePath, { recursive: true, force: true })
	}
	if (existsSync(tempPath)) {
		rmSync(tempPath, { recursive: true, force: true })
	}
})

const url_prefix = 'https://www.sqlite.org/'

// Check that the latest release of SQLite will be installed when version
// and year was not defined
test('setup without any version or year defined', async () => {
	const now = Date.now()

	// execute setup_sqlite intallation
	await setup_sqlite(undefined, undefined, url_prefix)

	// run the cleanup callbacks
	await cleanup()
})

test('setup with version number only', async () => {
	const now = Date.now()

	// execute setup_sqlite intallation
	await setup_sqlite('3.38.5', undefined, url_prefix)

	// run the cleanup callbacks
	await cleanup()
})

test('setup with version year only', async () => {
	const now = Date.now()

	// execute setup_sqlite intallation
	await setup_sqlite(undefined, '2021', url_prefix)

	// run the cleanup callbacks
	await cleanup()
})

// Create a test for each distributed sqlite version
for ( const [year, versions] of Object.entries(distributions) ) {
	versions.forEach(version => {
		test(`setup by installing sqlite version: ${version}`, async () => {
			const now = Date.now()

			// Execute the setup_sqlite function where none of the distributions
			// will cause an error from being thrown
			await setup_sqlite(version, year, url_prefix)

			// call the cleanup method just like the run method will
			await cleanup()

			// Check that the sqlite version has been cached
			expect(find('sqlite', version)).not.toBe('')
		})
	});
}

for ( const [year, versions] of Object.entries(distributions) ) {
	versions.forEach(version => {
		test(`setup using cached sqlite version: ${version}`, async () => {
			const now = Date.now()

			// Execute the setup_sqlite function where none of the distributions
			// will cause an error from being thrown
			await setup_sqlite(version, year, url_prefix)

			// call the cleanup method just like the run method will
			await cleanup()

			// Check that the sqlite version has been cached
			expect(find('sqlite', version)).not.toBe('')
		})
	});
}
