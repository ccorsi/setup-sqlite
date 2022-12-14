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
const { downloadTool, extractZip, cacheDir, find, extract7z, extractXar, extractTar } = require('@actions/tool-cache');
const { CodeGenerator } = require('@babel/generator');
const { toComputedKey } = require('@babel/types');
const { writeFile, rm, open, rmdir, readdir, stat } = require('fs/promises');
const { sep } = require('path');
const { connected } = require('process');
const { text } = require('stream/consumers');

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
        // This is an invalid version string so throw an error
        throw new Error(`Invalid sqlite version: ${version}`)
    }

    let versions = version.split('.')

    // Determine that the version string has between 1 and 4 sections
    if (versions.length > 4) {
        // This is an invalid version so throw an error
        throw new Error(`Invalid sqlite version: ${version}`)
    }

    // The passed version string is correctly formatted thus create the
    // required version string
    let versionString = ''

    // Append the defined version number that was passed.
    versions.forEach( (ver) => {
        if (isNaN(Number(ver))) {
            // Version has to be a number
            throw new Error(`Invalid sqlite version format: ${version}`)
        }

        // Complain only if the version number is greater than 2 digits unless it
        // is the first version number digit.
        if (versionString.length > 0 && ( ver.length == 0 || ver.length > 2 )) {
            // Version number cannot be zero or greater than 2 entries
            throw new Error(`Invalid sqlite version format: ${version}`)
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
            throw new Error(`The operating system: ${platform()} sqlite setup is not supported by this action`)
    }
}

module.exports.create_target_filename = create_target_filename

/**
 * This method will create the url from the passed information that will be used to
 * download the particular version of sqlite.  This method will check if the year and
 * version parameters are correct.  It will not detemrine if the url_prefix is correctly
 * formatted.  This will be determine when the http request will be performed.
 *
 * @param {string} version The version of sqlite to download, X.Y.Z[.M]
 * @param {string} year The year that the sqlite distribution was released, YYYY
 * @param {string} url_prefix The url prefix that will be combined with the version and year
 * @returns The url used to download the particular version of sqlite
 */
function create_sqlite_url(version, year, url_prefix) {
    // Determine if the year was formatted correctly
    if ( ! /^\d{4}$/.test(year) ) {
        throw new Error(`Invalid year: ${year} should be formatted as YYYY`)
    }

    // create the target filename for this platform using the passed version
    let target = create_target_filename(version)

    // Add an '/' to the end of the url if none exist
    let url = url_prefix.endsWith('/') ? url_prefix : url_prefix + '/'

    return [ `${url}${year}/${target}`, target ]
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
    let cachePath = find('sqlite', version)

    if (cachePath.length > 0) {
        core.debug(`Using cached sqlite version ${version}`)
        await addCachedPath(cachePath);
        return // no need to do anything else
    }

    core.info(`Installing sqlite version: ${version}`)

    let [ url, targetName ] = create_sqlite_url(version, year, url_prefix)

    try {
        core.debug(`Installing sqlite version: ${version} from ${url}`)

        // TODO: This code will be replaced with the tool-cache downloadUrl call
        //      as soon as I understand why it is failing.
        let httpClient = new hc.HttpClient('setup-sqlite', [], {
            allowRetries: true,
            maxRetries: 3
        })

        // connect to the given url to retreive the requested version of sqlite
        let response = await httpClient.get(url)

        if (response.message.statusCode != 200) {
            // unable to retreive the sqlite file from the requested sqlite version
            throw new Error(`Unable to download sqlite version ${version} from ${url}`)
        }

        let body = await new Promise((resolve, reject) => {
            // TODO: replace this with the use of a file handler so that the buffer
            //       will not be limited to the memory available to the process.

            // create a buffer to store the file data that will be save to a file
            let fileData = Buffer.alloc(0)

            response.message.on('data', (chunk) => {
                fileData = Buffer.concat([fileData, chunk])
            })

            response.message.on('error', (err) => {
                // consume the remaining message before rejecting this promise
                response.message.resume()
                reject(err)
            })

            response.message.on('end', () => {
                resolve(fileData)
            })
        })

        // Store data into the targeted file
        await writeFile(targetName, body)

        // TODO: Why doesn't this command work!!!
        // download the requested sqlite version
        // const targetName = await downloadTool(url)

        // Add a cleanup callback that will deleted the target file
        add_cleanup(async () => {
            core.debug(`Deleting target file: ${targetName}`)
            await rm(targetName)
            core.debug(`Deleted target file ${targetName}`)
        })

        // unzip the files to a local host directory and add the path
        let sqliteExtractedFolder

        if (process.platform == 'win32') {
            sqliteExtractedFolder = await extractZip(targetName)
        // } else if (process.platform == 'darwin') {
        //     sqliteExtractedFolder = await extractXar(targetName)
        } else {
            sqliteExtractedFolder = await extractTar(targetName, undefined, [
                'xz',
                '--strip',
                '1'
            ])
        }

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

        core.debug(`Installed sqlite version: ${version} from ${url}`)
    } catch(err) {
        core.debug(`Installation of sqlite version: ${version} generated an error`)
        core.debug(err)
        // re-throw the caught error
        throw err
    }
}

let cleanup_fcns = new Set()

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
function remove_cleanup(fcn) {
    if (cleanup_fcns.delete(fcn)) {
        core.debug('The cleanup function:', fcn, 'was added to the cleanup function set')
    } else {
        core.debug('Unable to add the cleanup function:', fcn, 'to the cleanup functin set')
    }
}

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
