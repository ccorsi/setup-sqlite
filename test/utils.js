/*
 * This file contains different utilities functions that will be used throughout the
 * different tests.
 */

const core = require('@actions/core')
const { existsSync, rmSync } = require('fs')
const path = require('path')

/*
 * This method will create the runner temporary and tool cache directories that
 * contains the passed name as part of these directories.  This method will then
 * return a function that can be used to delete the newly created runner directories.
 * This function can be used within the before/after jest callbacks.
 *
 * @param name unique name used to create runner directories
 * @return function the can be used to detele the created directories
 */
module.exports.setup_runner_temp_and_cache = (name) => {
    const root_directory = path.join(__dirname, name)
    const [ tempPath, cachePath ] =  [
        path.join(root_directory, 'TEMP'),
        path.join(root_directory, 'CACHE')
    ]

    core.debug(`Created runner temp path: ${tempPath} and runner tool cache path: ${cachePath}`)

    // Set temp and tool directories before importing (used to set global state)
    process.env['RUNNER_TEMP']       = tempPath
    process.env['RUNNER_TOOL_CACHE'] = cachePath

    return () => {
        if (existsSync(root_directory)) {
            rmSync(root_directory, { recursive: true, force: true})
        }
    }
}

/*
 * This function is used to set the input values for the given name.  This can be
 * used to setup different test inputs.
 *
 * @param name The name of the input variable
 * @param value The value associated with the named input variable
 */
module.exports.set_input = function set_input(name, value) {
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = String(value)
}

