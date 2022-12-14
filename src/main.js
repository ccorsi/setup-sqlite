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

const core = require('@actions/core')
const { setup_sqlite, cleanup } = require('./setup')

async function run() {
    try {
        core.debug('executing sqlite setup action')
        let version = core.getInput('sqlite-version')
        let year = core.getInput('sqlite-year')
        let url_prefix = core.getInput('sqlite-url-path')

        setup_sqlite(version, year, url_prefix)

    } catch(err) {
        core.error('An error was generated when installing sqlite')
        core.error(err)
        // Is any of the two above error messages required since we are setting this action to failed
        core.setFailed(err)
    } finally {
        // Cleanup anything that is not supposed to be around when completed installing the
        // requested version of sqlite or remove all files that where not cleaned up because of
        // errors during installation of requested version of sqlite
        await cleanup()
        core.debug('completed execution of sqlite setup action')
    }
}

run()
