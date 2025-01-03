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

While here is a table of the different outputs that will be produced with this action

| Name | Description | Example |
| --- | --- | --- |
| cache-hit | A boolean value to indicate if this sqlite version is a cached version | true |
| sqlite-version | The installed SQLite version | 3.44.0 |
| sqlite-path | The path of the installed SQLite version | '/tmp/my/cache-directory/sqlite-version-root' |

**Basic:**

```yaml
steps:
- uses: actions/checkout@v3
- uses: actions/setup-sqlite@v1
  with:
    sqlite-version: 3.40.0
    sqlite-year: 2022
- run: sqlite3 user.db "create table foo (a int, b text)"
```

The `sqlite-version` and `sqlite-year` inputs are required.

The action will first check the local cache for a semver match. If unable to find a specific version in the cache, the action will attempt to download the specified version and year of sqlite. It will pull the selected version from [SQLite releases](https://www.sqlite.org/chronology.html).  While the release list is fairly extensive, not all of these versions are available so it is possible that older ones will not accessible.

### Supported version syntax

The `sqlite-version` input uses the same versioning format that the sqlite team uses, check out [History of SQLite Releases](https://www.sqlite.org/chronology.html).  The `sqlite-year` input uses the YYYY format and is required input to be able to download the sqlite version.

Examples:

| sqlite-version | sqlite-year |
| -------------- | ----------- |
| 3.40.0 | 2022 |
| 3.35.0 | 2021 |
| 3.34.0 | 2020 |
| 3.30.1 | 2019 |

While the above versions are currently accessible, not all of the older versions are available.

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
        uses: actions/setup-sqlite@v1
        with:
          sqlite-version: ${{ matrix.sqlite }}
      - run: sqlite3 foo "create table foo (a int, b text)"
```

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice. See [our code of conduct](CODE_OF_CONDUCT.md)
