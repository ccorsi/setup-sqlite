const { create_sqlite_url, formatVersion } = require("../src/setup")

const platforms = {
    'win32':  'win32',
    'linux':  'linux',
    'darwin': 'osx'
}

const inputs = [
    [ '101.1.1.1', '2222' ],
    [ '101.1.2',   '2021' ],
    [ '1',         '1984' ],
    [ '1.2',       '1985' ],
    [ '1.21',      '1986' ],
    [ '3.4.0',     '2022' ],
    [ '3.4.10',    '2021' ],
    [ '3.14.10.1', '2020' ],
    [ '3.14.10.12','2020' ],
    [ '3.1.2.1',   '1999' ],
    [ '3.40.1',    '2019' ]
]

let expected = []

inputs.forEach(([version, year]) => {
    // Convert the correct version into the expected version string
    [ version, _ ] = formatVersion(version)

    // Produce the expected target and expected url from the tests
    const expectedTarget = `sqlite-tools-${platforms[process.platform]}-x86-${version}.zip`
    const expectedURL = `https://www.sqlite.org/${year}/${expectedTarget}`

    // Add the expected target and expected url to the expected list
    expected.push([ expectedTarget, expectedURL ])
})

test('correct download url and target', async () => {
    const version = '3.4.0'
    const year = '2022'
    const url_prefix = 'https://www.sqlite.org/'

    const [ _, url, target ] = await create_sqlite_url(version, year, url_prefix)

    const expectedTarget = `sqlite-tools-${platforms[process.platform]}-x86-3040000.zip`
    expect(target).toBe(expectedTarget)

    const expectedURL = `${url_prefix}${year}/${expectedTarget}`
    expect(url).toBe(expectedURL)
})

for (let cnt = 0 ; cnt < inputs.length ; cnt++) {
    const [version, year] = inputs[cnt]
    const [expectedTarget, expectedURL] = expected[cnt]

    test(`correct download for version ${version} and year ${year}`, async () => {
        const url_prefix = 'https://www.sqlite.org/'

        const [ _, url, target ] = await create_sqlite_url(version, year, url_prefix)

        expect(target).toBe(expectedTarget)
        expect(url).toBe(expectedURL)
    })
}
