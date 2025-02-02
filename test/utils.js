/*
 * This file will contain different utilities functions that will be used throuhout the
 * different tests.
 */

const core = require('@actions/core')
const { existsSync, rmSync } = require('fs')
const path = require('path')

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

module.exports.set_input = function set_input(name, value) {
    process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`] = String(value)
}
