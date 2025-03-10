// ==================================================================================
// MIT License

// Copyright (c) 2022-2025 Claudio Corsi

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
const { sep, join } = require('path');
const { randomUUID } = require('crypto')

// Default retry count used when using the GitHub REST APi.
const default_retry_count = 3

// for testing purposes export this value to check that the expected result will be set
// whenever we incorrectly set the retry count
module.exports.default_retry_count = default_retry_count

/*
 * This method will return the retry count that will be used whenever we are using the
 * GitHub REST API.  It will determine if the sqlite-retry-count input was an integer
 * and greater than one.  If it is, then it will use that value are the retry count.
 */
function set_max_retry_count() {
    let input = core.getInput('sqlite-retry-count')
    let value = default_retry_count

    let v = Number(input)
    if (Number.isInteger(v)) {
        if (v > 0) {
            core.info(`Setting retry count to ${v}`)
            value = v
        } else {
            core.warning(`An invalid sqlite-retry-count was passed, the value has to be greater than 0, defaulting to ${default_retry_count}`)
        }
    } else if (input?.length > 0) {
        core.warning(`An invalid sqlite-retry-count was passed, defaulting to ${default_retry_count}`)
    }

    return value
}

const max_retry_count = set_max_retry_count()

module.exports.max_retry_count = max_retry_count

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
        const message = 'A valid SQLite version is required'
        core.error(message)
        // This is an invalid version string so throw an error
        throw new Error(message)
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

/**
 * This function will determine what type of build will be retrieved depending
 * on the version number.  The different builds started to make builds for x64
 * instead of x86 from version 3.44.0 onwards.  This function will check the
 * version and return the string 'x86' for versions before 3.44.0 and 'x64' for
 * newer versions.
 *
 * @param {string} version expected formatted version string
 * @returns {string} will return either 'x86' or 'x64'
 */
function get_build_type(version) {
    const major = Number(version.substring(0, version.length - 6))
    const minor = Number(version.substring(version.length - 6, version.length - 4))

    if (major < 2) {
        return 'x86'
    } else if (major > 3) {
        return 'x64'
    } else if (minor < 44) {
        return 'x86'
    } else {
        return 'x64'
    }
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

    // determine if this version is built again x86 or x64.
    build_type = get_build_type(version)

    // Determine which target to download given our operating system
    switch(process.platform) {
        // windows versions
        case 'win32':
            return `sqlite-tools-${build_type == 'x86' ? 'win32' : 'win'}-${build_type}-${version}.zip`
        // linux versions
        case 'linux':
            return `sqlite-tools-linux-${build_type}-${version}.zip`
        // macos versions
        case 'darwin':
            return `sqlite-tools-osx-${build_type}-${version}.zip`
        // unsupported versions
        default:
            throw new Error(`The operating system: ${process.platform} for SQLite is not supported by this setup action`)
    }
}

/*
 * This method will be used whenever we need to wait a certain amount of time before continuing.
 * This is the case whenever we've reach the rate limit on the github rest api calls.  This method
 * will sleep for the passed seconds before continuing.
 *
 * @param {Number} the number of seconds that this method will sleep
 * @return {Promise<void>}  A Promise instance that doesn't return any value
 */
function sleep(seconds) {
   return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

/*
 * This method is used to process a GitHub REST API GET call using the passed client object with the
 * passed uri.  The getCauseMessage will be called when an error was generated when performing the
 * get call.  While the getRetryCountMessage will be called when the retry count has been exhausted.
 * While the getUnknownStatusCodeMessage will be called when the return status code isn't 200 or 403
 * without the rate limit message header information.
 *
 * @param {HttpClient} client instance used to make the get call
 * @param {string} uri http get command that the client will use
 * @param {callback} getCauseMessage callback used to get the message to pass to the cause Error
 * @param {callback} getRetryCountMessage callback used to get the message to pass to the retry count exhaust error
 * @param {callback} getUnknownStatusCodeMessage callback used to get the message to pass to the unknown status code error
 *
 * @returns {HttpResponse} a successful response instance to the HTTP GET call
 */
async function executeClientGetCall(client, uri,
    getCauseMessage = (cause) => {
        return `The client request: ${uri} generated the error: ${cause.stack}`
    }, getRetryCountMessage = () => {
        return `The retry count was exhausted for client request: ${uri}`
    }, getUnknownStatusCodeMessage = (res) => {
        return `The client request: ${uri} returned an unknown status code: ${res.message.statusCode} with message: ${res.message.statusMessage}`
}) {
    let res, retryCount = 0

    do {
        try {
            // Execute the get call using the passed uri
            res = await client.get(uri)
            if (res.message.statusCode == 200) {
                // The get call was sucessful thus return
                return res
            }
        } catch (cause) {
            // This will generate an exception
            const message = getCauseMessage(cause)
            core.error(message)
            throw new Error(message, { cause })
        }

        if (retryCount == max_retry_count) {
            // eat the rest of the input information so that no memory leak will be generated
            res.message.resume()

            // We've exhausted the retry count
            const message = getRetryCountMessage()
            core.warning(message)
            throw new Error(message)
        } else if (res.message.statusCode === 403 && res.message.headers['retry-after']) {
            // eat the rest of the input information so that no memory leak will be generated
            res.message.resume()

            // Get the minimum amount of seconds that one should wait before trying again.
            const secondsToWait = Number(res.message.headers['retry-after'])

            core.warning(`You have exceeded your rate limit. Retrying in ${secondsToWait} seconds.`);

            // retry the command after the amount of second within the header retry-after attribute
            await sleep(secondsToWait)

            // increment the retryCount
            retryCount += 1

        } else if (res.message.statusCode === 403 && res.message.headers['x-ratelimit-remaining'] === '0') {
            // eat the rest of the input information so that no memory leak will be generated
            res.message.resume()

             // Get the ratelimit reset date in utc epoch seconds
            const resetTimeEpochSeconds = res.message.headers['x-ratelimit-reset'];

            // Get the current utc time in epoch seconds
            const currentTimeEpochSeconds = Math.floor(Date.now() / 1000);

            // Determine the minimum amount of seconds that one should wait before trying again.
            const secondsToWait = resetTimeEpochSeconds - currentTimeEpochSeconds;

            core.warning(`You have exceeded your rate limit. Retrying in ${secondsToWait} seconds.`);

            // retry the command after the amount of second within the header retry-after attribute
            await sleep(secondsToWait)

            // increment the retryCount
            retryCount += 1

        } else {
            // eat the rest of the input information so that no memory leak will be generated
            res.message.resume()

            // We've received a status code that we don't know how to process
            const message = getUnknownStatusCodeMessage(res)
            core.warning(message)
            throw new Error(message)
        }
    } while (true)
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
        let res = await executeClientGetCall(client, tag)

        // get the returned body
        let body = await res.readBody()

        // convert body into a json object
        const jsonTag = JSON.parse(body)

        // extract the commit url
        let commitUrl = jsonTag["object"]["url"]

        // retrieve information for the commit url
        res = await executeClientGetCall(client, commitUrl)

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

    core.info('Executing tags information request for all version- tags')

    let res = await executeClientGetCall(client, tags)

    // Get the returned string information
    let body = await res.readBody()

    // convert the returned string into a json object
    const jsonTags = JSON.parse(body)

    // insure that the returned array contains at least one element
    if (jsonTags.length == 0) {
        throw new Error(`No SQLite tags information available at ${tags}`)
    }

    core.debug('Processing returned versions information')

    // Get the first entry in the list for the verison information
    let entry = jsonTags[0]
    let entry_version = entry["ref"].split('-')[1].split('.').map(Number)

    // Iterate through each returned entry and determine which is the latest version
    jsonTags.forEach((tag) => {
        const version = tag["ref"].split('-')[1].split('.').map(Number)

        // Determine if the current tag is newer than the currently newest one
        if (( version[0] > entry_version[0] ) ||
            ( version[0] == entry_version[0] && version[1] > entry_version[1] ) ||
            ( version[0] == entry_version[0] && version[1] == entry_version[1] && version[2] > entry_version[2] ) ) {
            // Replace the current newest tag within this newer tag
            entry = tag
            entry_version = version
        }
    })

    // we've found an entry with a valid tag information, get the version
    version = entry["ref"].substring("refs/tags/version-".length)

    core.debug(`Found version: ${version}`)

    // get the commit url to determine year of above version
    let commitUrl = entry["object"]["url"]

    core.debug(`Getting date information using commit url: ${commitUrl}`)

    // retrieve information for the commit url
    res = await executeClientGetCall(client, commitUrl)

    // extract body
    body = await res.readBody()

    // convert into json object
    const jsonCommit = JSON.parse(body)

    core.debug('Extracting date information from json object')

    // extract the year information
    let date = new Date(jsonCommit["committer"]["date"])

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

        // Create the destination file using the RUNNER_TEMP directory.
        targetName = join(process.env['RUNNER_TEMP'], randomUUID(), targetName)

        // Download the targeted SQLite version
        targetName = await downloadTool(url, targetName)

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
        core.error(`Installation of SQLite version: ${version} generated an error`)
        core.error(err.stack)
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
 * root directory to the path so that it can be used.  If none were found then it
 * add the passed root directory.
 *
 * This is being dealt this way since earlier versions of the SQLite bundles executables
 * were located within a subdirectory while newer version of the bundles the executables
 * are located within the passed root directory.
 *
 * @param {string} cacheRootPath the root directory name where the sqlite version was cached
 */
async function addCachedPath(cacheRootPath) {
    let addedPath = false

    const items = await readdir(cacheRootPath);

    items.forEach(async (item) => {
        const name = `${cacheRootPath}${sep}${item}`;
        const stats = await stat(name);
        if (stats.isDirectory()) {
            core.debug(`Adding directory "${name}" to path`)
            core.addPath(name)
            core.info(`Added directory "${name}" to path`)
            addedPath = true
        }
    });

    if ( addedPath ==  false) {
        core.debug(`Adding directory "${cacheRootPath}" to path`)
        core.addPath(cacheRootPath)
        core.info(`Added directory "${cacheRootPath}" to path`)
    }
}

/**
 * This method will add a function to the list of function calls that will be
 * called when the cleanup method is called.
 *
 * @param {function} fcn The function that will be called
 */
function add_cleanup(fcn) {
    core.debug(`Adding function: ${fcn} to cleanup function set`)
    cleanup_fcns.add(fcn)
    core.debug(`Added function: ${fcn} to cleanup function set: ${cleanup_fcns}`)
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
            core.debug(`Executing cleanup function: ${fcn}`)
            await fcn()
        } catch(err) {
            core.debug(`An error was generated when processing cleanup function: ${fcn} with error: ${err}`)
        } finally {
            core.debug(`Completed executing cleanup function: ${fcn}`)
        }
    });
    cleanup_fcns.clear()
}

module.exports.cleanup = cleanup
