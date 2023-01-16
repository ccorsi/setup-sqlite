# setup-node

[![build-test](https://github.com/ccorsi/setup-sqlite/actions/workflows/test.yml/badge.svg)](https://github.com/ccorsi/setup-sqlite/actions/workflows/test.yml)
<!-- [![versions](https://github.com/ccorsi/setup-sqlite/actions/workflows/versions.yml/badge.svg)](https://github.com/ccorsi/setup-sqlite/actions/workflows/versions.yml)
[![proxy](https://github.com/ccorsi/setup-sqlite/actions/workflows/proxy.yml/badge.svg)](https://github.com/ccorsi/setup-sqlite/actions/workflows/proxy.yml) -->

This action provides the following functionality for GitHub Actions users:

- Downloading and caching the distribution of the requested sqlite version, and adding it to the PATH

## Usage

See [action.yml](action.yml)

Here is a table of the different inputs that can be used with this action

| Name | Description | Optional | Default Value |
| ---- | ----------- | -------- | ------------- |
| sqlite-version | version of the SQLite to install | true |  |
| sqlite-year | release year of the SQLite to install | true |  |
| sqlite-url-path | the SQLite download site | true | https://www.sqlite.org/ |

While this action does include the option to include the sqlite-year and sqlite-url-path.  It is recommended that you not use these inputs unless required.
I do believe that in the future those options might be removed from this setup action.  At the very least, the sqlite-url-path will probably be deprecated
since this should not change now or in the future.

**Basic:**

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-sqlite@v2
  with:
    sqlite-version: 3.40.0
- run: sqlite3 user.db "create table foo (a int, b text)"
```

The `sqlite-version` and `sqlite-year` inputs are required.

The action will first check the local cache for a semver match. If unable to find a specific version in the cache, the action will attempt to download the specified version and year of SQLite. It will pull the selected version from [SQLite releases](https://www.sqlite.org/chronology.html).  While the release list is fairly extensive, not all of these versions are available so it is possible that older ones will not be accessible.

### Supported version syntax

The `sqlite-version` input uses the same versioning format that the SQLite team uses, check out [History of SQLite Releases](https://www.sqlite.org/chronology.html).  The `sqlite-year` input uses the YYYY format and even though it isn't required input to download the SQLite version.  It would greatly simplify the process of downloading and
installing a version of SQLite when the year is supplied.

Examples:

| sqlite-version | sqlite-year |
| -------------- | ----------- |
| 3.40.0 | 2022 |
| 3.35.0 | 2021 |
| 3.34.0 | 2020 |
| 3.30.1 | 2019 |

While the above versions are currently accessible, not all of the older versions are available.

### Post Installation Defined Variables

Whenever this setup action completes an installation of SQLite.  It will then produce the following output variables:

| Name | Type | Description |
| ---- | ---- | ----------- |
| sqlite-version | semver format | The requested SQLite version installed |
| cache-hit | boolean | True, if using an already downloaded version of SQLite |
| sqlite-bin | directory path | A directory path where the requested SQLite version is located |

The above variables can be access using the standard output reference mechanism that is part of GitHub Actions.

## Matrix Testing

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        sqlite: [ 3.40.0, 3.35.0 ]
    name: SQLite ${{ matrix.sqlite }} sample
    steps:
      - uses: actions/checkout@v3
      - name: Setup SQLite
        uses: actions/setup-sqlite@v2
        with:
          sqlite-version: ${{ matrix.sqlite }}
      - run: sqlite3 foo "create table foo (a int, b text)"
```

Note, that the above example only provides the different versions oF SQLite and does not include the release year for those versions.  This is because actions that
use multiple matrix definitions will use a conbination of the different field definitions.  Thus, if you want to use SQLite v3.40.0 released on 2022 and v3.35.0
released on 2020 can not be defined within a matrix definition.  Defining a sqlite-version and sqlite-year for the aforementioned version combinations would then
cause requests for v3.40.0 released on 2020 which is not a valid version/year information.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice. See [our code of conduct](CODE_OF_CONDUCT.md)
