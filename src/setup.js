// ==================================================================================
// MIT License

// Copyright (c) 2022 Claudio Corsi

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
// ==================================================================================

const core = require('@actions/core');
const hc = require('@actions/http-client');
const { extractZip, cacheDir, find, downloadTool } = require('@actions/tool-cache');
const { rm, readdir, stat } = require('fs/promises');
const { sep } = require('path');

/**
 * This method is passed a version in string format that will then be converted into
 * the expect format to be able to append to the download url to retreive the sqlite
 * distribution.
 *
 * This function will insure that the correct version number string will be returned
 * for the passed version string.  It will take a version W.X.Y.Z and turn it into
 * WXXYYZZ.  While it will take a version number like X.Y.Z and turn it into XYYZZ00.
 * The zeros are padded for any version that doesn't contain 4 sections of the version
 * number.
 *
 * @param {string} version  The version of sqlite to setup
 */
function formatVersion(version) {
    // Determine that the passed version is defined
    if (version == undefined || version.length == 0) {
        core.info('A valid SQLite version is required')
        // This is an invalid version string so throw an error
        throw new Error(`A valid sqlite version is required`)
    }

    let versions = version.split('.')

    // Determine that the version string has between 1 and 4 sections
    if (versions.length > 4) {
        // This is an invalid version so throw an error
        throw new Error(`Invalid sqlite version: ${version}, required X.Y.Z[.S] format`)
    }

    // The passed version string is correctly formatted thus create the
    // required version string
    let versionString = ''

    // Append the defined version number that was passed.
    versions.forEach( (ver) => {
        if (isNaN(Number(ver))) {
            // Version has to be a number
            throw new Error(`Invalid SQLite version format: ${version}`)
        }

        // Complain only if the version number is greater than 2 digits unless it
        // is the first version number digit.
        if (versionString.length > 0 && ( ver.length == 0 || ver.length > 2 )) {
            // Version number cannot be zero or greater than 2 entries
            throw new Error(`Invalid SQLite version format: ${version}`)
        }

        // Append the current version number and append a 0 if the length is
        // less than 2 unless it is the first version number
        versionString += versionString.length > 0 && ver.length < 2 ? `0${ver}` : ver
    })

    // Add 00 padding to complete the version used to download sqlite with
    for (var cnt = versions.length ; cnt < 4 ; cnt++) {
        versionString += "00"
    }

    // we are done so let us return the generated version string needed for download
    return versionString
}

module.exports.formatVersion = formatVersion

/**
 * This method will return the expected sqlite to be downloaded.
 * It will not include the url that will be prefixed by another
 * call.
 *
 * @param {string} version the version included with the target file name
 * @returns
 */
function create_target_filename(version) {
    // Convert the passed version string into the expected download version string
    version = formatVersion(version)

    // Determine which target to download given our operating system
    switch(process.platform) {
        // windows versions
        case 'win32':
            return `sqlite-tools-win32-x86-${version}.zip`
        // linux versions
        case 'linux':
            return `sqlite-tools-linux-x86-${version}.zip`
        // macos versions
        case 'darwin':
            return `sqlite-tools-osx-x86-${version}.zip`
        // unsupported versions
        default:
            throw new Error(`The operating system: ${process.platform} for SQLite is not supported by this setup action`)
    }
}

module.exports.create_target_filename = create_target_filename

/**
 * This method will determine the latest version of the SQLite distribution
 * using the tags information on the SQLite GitHub repository.  It will
 *
 * @param {string} version The version of sqlite download
 * @param {string} year The year that the sql distribution was released
 */
async function getSQLiteVersionInfo(version, year) {
    // check if the version information was set
    if (version != undefined && version != '') {
        // create the version specific url
        const tag = `https://api.github.com/repos/sqlite/sqlite/git/ref/tags/version-${version}`

        // Create a client connection
        const client = new hc.HttpClient(`github-sqlite-tag-${version}`)

        // retrieve a list of tags
        let res = await client.get(tag)

        // check if the request was successful
        if (res.message.statusCode != 200) {
            core.info(`The requested ${tag} failed with status code: ${res.message.statusCode} and status message: ${res.message.statusMessage}`)
            throw new Error(`Unable to retrieve version information for SQLite version ${version}`)
        }

        // get the returned body
        let body = await res.readBody()

        // convert body into a json object
        const jsonTag = JSON.parse(body)

        // extract the commit url
        let commitUrl = jsonTag["object"]["url"]

        // retrieve information for the commit url
        res = await client.get(commitUrl)

        // check to see that the get was successful
        if (res.message.statusCode != 200) {
            core.info(`The commit url: ${commitUrl} request failed with status code: ${res.message.statusCode} and message: ${res.message.statusMessage}`)
            throw new Error(`Unable to get version information for SQLite version ${version}`)
        }

        // extract body
        body = await res.readBody()

        // convert into json object
        const jsonCommit = JSON.parse(body)

        // extract the year information
        let date = new Date(jsonCommit["committer"]["date"])

        // get associated year for commit
        year = `${date.getFullYear()}`

        // print some debug information
        core.debug(`Found version: ${version} for year: ${year}`)

        // return version and year for the latest release of SQLite
        return [ version, year ]
    }

    // we know that the version is set to undefined or an empty string....
    // let us check if the year was defined.
    if (year != undefined && year != '') {
        // the year information is only relevant with the version
        core.warning(`Year was defined but will be ignored since version was not defined.`)
    }

    // Used to retrieve the latest SQLite version information
    const tags = 'https://api.github.com/repos/sqlite/sqlite/git/matching-refs/tags/version-'

    // Create a client connection
    const client = new hc.HttpClient('github-sqlite-version-tags')

    let res = await client.get(tags)

    if (res.message.statusCode != 200) {
        // eat the rest of the input information so that no memory leak will be generated
        res.message.resume()

        core.info(`Unable to get tags information for SQLite version ${version} with status code: ${res.message.statusCode} and message: ${res.message.statusMessage}`)
        // Unable to retrieve the tags information from GitHub
        throw new Error(`Unable to get tags information from GitHub for SQLite version: ${version} with status message: ${res.message.statusMessage}`)
    }

    // Get the returned string information
    let body = await res.readBody()

    // convert the returned string into a json object
    const jsonTags = JSON.parse(body)

    // insure that the returned array contains at least one element
    if (jsonTags.length == 0) {
        throw new Error(`No SQLite tags information available at ${tags}`)
    }

    // Get the first entry in the list for the verison information
    let entry = jsonTags.find((entry) => entry["name"].startsWith('version-'))

    // Determine if we've found any entries
    if (entry == undefined) {
        throw new Error(`No SQLite version information was found for SQLite version: ${version}`)
    }

    // we've found an entry with a valid tag information, extract data
    // get the version
    version   = entry["name"].substring("version-".length)

    // get the commit url to determine year of above version
    let commitUrl = entry["commit"]["url"]

    // retrieve information for the commit url
    res = await client.get(commitUrl)

    // check to see that the get was successful
    if (res.message.statusCode != 200) {
        core.info(`Information for commit url: ${commitUrl} was not retrieved`)
        core.info(`The returned status code: ${res.message.statusCode} and message: ${res.message.statusMessage}`)
        throw new Error(`Unable to get version information SQLite version ${version}, status code: ${res.message.statusCode}`)
    }

    // extract body
    body = await res.readBody()

    // convert into json object
    const jsonCommit = JSON.parse(body)

    // extract the year information
    let date = new Date(jsonCommit["commit"]["committer"]["date"])

    // get associated year for commit
    year = `${date.getFullYear()}`

    // print some debug information
    core.debug(`Found version: ${version} for year: ${year}`)

    // return version and year for the latest release of SQLite
    return [ version, year ]
}

/**
 * This method will create the url from the passed information that will be used to
 * download the particular version of sqlite.  This method will check if the year and
 * version parameters are correct.  It will not detemrine if the url_prefix is correctly
 * formatted.  This will be determine when the http request will be performed.
 *
 * @param {string} version The version of sqlite to download, X.Y.Z[.M]
 * @param {string} year The year that the sqlite distribution was released, YYYY
 * @param {string} url_prefix The url prefix that will be combined with the version and year
 * @returns The version, download url and target file name for request the version of sqlite
 */
async function create_sqlite_url(version, year, url_prefix) {
    try {
        if (version == undefined || version == '') {
            // If the version is an empty string then we retrieve the latest
            // version that is located on github sqlite repository
            [ version, year ] = await getSQLiteVersionInfo(version, year)
        } else if (year == undefined || year == '') {
            [ version, year ] = await getSQLiteVersionInfo(version, year)
        }
    } catch(err) {
        core.info(`An error was generated when trying to retrieve SQLite version information with error message: ${err.message}`)
        throw err
    }

    // Determine if the year was formatted correctly
    if ( ! /^\d{4}$/.test(year) ) {
        throw new Error(`Invalid year: ${year} should be formatted as YYYY`)
    }

    // create the target filename for this platform using the passed version
    let target = create_target_filename(version)

    // Add an '/' to the end of the url if none exist
    let url = url_prefix.endsWith('/') ? url_prefix : url_prefix + '/'

    return [ version, `${url}${year}/${target}`, target ]
}

module.exports.create_sqlite_url = create_sqlite_url

/**
 * This is the main function that is called to download and install the passed
 * version of sqlite.  It will use the version, year and url prefix to download
 * the requested sqlite version.  It will then add the distribution to the local
 * host directory and add the sqlite to the path.
 *
 * Before installing the sqlite version.  It will check if the requested version
 * was already cached.  If it has, it will then just add the cached version to
 * the path instead.
 *
 * @param {string} version the version to download
 * @param {string} year the year the passed version was distributed
 * @param {string} url_prefix the url to where the version can be downloaded
 */
module.exports.setup_sqlite = async function setup_sqlite(version, year, url_prefix) {
    let url, targetName

    // create the required version, url and targetName
    [ version, url, targetName ] = await create_sqlite_url(version, year, url_prefix)

    // determine if the given version was already cached or not
    let cachePath = find('sqlite', version)

    if (cachePath.length > 0) {
        core.info(`Using cached SQLite version ${version}`)
        await addCachedPath(cachePath);
        // Set the output entries
        setOutputs(true, version);
        return // no need to do anything else
    }

    core.info(`Installing SQLite version: ${version}`)

    try {
        core.debug(`Installing SQLite version: ${version} from ${url}`)

        if (process.platform == 'win32') {
            targetName = await downloadTool(url, targetName)
        } else {
            targetName = await downloadTool(url)
        }

        // Add a cleanup callback that will deleted the target file
        add_cleanup(async () => {
            core.debug(`Deleting target file: ${targetName}`)
            await rm(targetName)
            core.debug(`Deleted target file ${targetName}`)
        })

        core.debug(`Extracting zip file: ${targetName}`)

        // unzip the files to a local host directory and add the path
        const sqliteExtractedFolder = await extractZip(targetName)

        core.debug(`Extracted sqlite version ${version} to ${sqliteExtractedFolder}`)

        // Add a cleanup callback that will deleted the extracted directory
        add_cleanup(async () => {
            core.debug(`Deleting extracted directory ${sqliteExtractedFolder}`)
            await rm(sqliteExtractedFolder, { recursive: true })
            core.debug(`Deleted extracted directory ${sqliteExtractedFolder}`)
        })

        cachePath = await cacheDir(sqliteExtractedFolder, 'sqlite', version)

        // Find the sub-directory within cachePath since that is what needs to be
        // added to the path.
        await addCachedPath(cachePath);

        // set the output values
        setOutputs(false, version)

        core.info(`Installed sqlite version: ${version} from ${url}`)
    } catch(err) {
        core.debug(`Installation of SQLite version: ${version} generated an error`)
        core.debug(err)
        // re-throw the caught error
        throw err
    }
}

let cleanup_fcns = new Set()

/**
 * This method will set the output 'cache-hit' and 'sqlite-version' for
 * the output values of this action.  It will set cache-hit to true if we
 * are using a version that has already been cached, else we set this to
 * false.  It will set the sqlite-version output to the installed version.
 *
 * @param {boolean} cached if the version used was cached already
 * @param {string} version the installed version
 */
function setOutputs(cached, version) {
    core.setOutput('cache-hit', cached);
    core.setOutput('sqlite-version', version);
}

/**
 * This method will include the directory name that exists within the passed cached
 * root directory to the path so that it can be used.
 *
 * @param {string} cacheRootPath the root directory name where the sqlite version was cached
 */
async function addCachedPath(cacheRootPath) {
    const items = await readdir(cacheRootPath);

    items.forEach(async (item) => {
        const name = `${cacheRootPath}${sep}${item}`;
        const stats = await stat(name);
        if (stats.isDirectory()) {
            core.addPath(name);
        }
    });
}

/**
 * This method will add a function to the list of function calls that will be
 * called when the cleanup method is called.
 *
 * @param {function} fcn The function that will be called
 */
function add_cleanup(fcn) {
    core.debug('Adding function:', fcn, 'to cleanup function set')
    cleanup_fcns.add(fcn)
    core.debug('Added function:', fcn, 'to cleanup function set:', cleanup_fcns)
}

/**
 * This method will remove the passed function call from the set of methods that
 * will be called during the cleanup phase.
 *
 * @param {function} fcn the function that will be removed from the set
 */
// NOTE: Comment this out for now
// function remove_cleanup(fcn) {
//     if (cleanup_fcns.delete(fcn)) {
//         core.debug('The cleanup function:', fcn, 'was added to the cleanup function set')
//     } else {
//         core.debug('Unable to add the cleanup function:', fcn, 'to the cleanup functin set')
//     }
// }

/**
 * This method will be called at the end of processing the setup of the sqlite
 * distribution.  It will perform all of the requred cleanup actions that have
 * been included since this action was started.  This information will be part
 * of an array of methods that are executed one at a time.  This will insure
 * that all of the cleanup will not be missed.
 */
async function cleanup() {
    cleanup_fcns.forEach(async (fcn) => {
        try {
            core.debug('Executing cleanup function:', fcn)
            await fcn()
        } catch(err) {
            core.debug('An error was generated when processing cleanup function:', fcn, 'with error:', err)
        } finally {
            core.debug('Completed executing cleanup function:', fcn)
        }
    });
    cleanup_fcns.clear()
}

module.exports.cleanup = cleanup
