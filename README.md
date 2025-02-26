# setup-sqlite

[![build-test](https://github.com/ccorsi/setup-sqlite/actions/workflows/test.yml/badge.svg)](https://github.com/ccorsi/setup-sqlite/actions/workflows/test.yml)
[![bimonthly-test](https://github.com/ccorsi/setup-sqlite/actions/workflows/testbimonthly.yml/badge.svg)](https://github.com/ccorsi/setup-sqlite/actions/workflows/testbimonthly.yml)
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
| sqlite-retry-count | the retry count for github api calls | true | 3 |

Note that the input combination of the SQLite version and year would greatly shorten the installation of SQLite.  Thou,
the requirement of the year is not required for a given version but an invalid version/year combination will cause the
action to fail.  Note that the missing year will cause the installation process to take a bit longer to complete.
While not defining the version and year will take the longest time to install.  The recommended inputs would be to
correctly define the version and year of the SQLite installation.  This information can be found on the
[SQLite releases](https://www.sqlite.org/chronology.html) page.

The addition of the sqlite-retry-count optional option is only useful in the case that you don't define your
version/year combination.  The retry count is used to determine how many tries the setup sqlite action will make
github api calls before exiting the setup sqlite action.  The github api call is only used to be able to get the year
associated to the sqlite version that is being requested.  The version/year combination is necessary to be able to
correctly format the download url for the requested version of sqlite.  The advantage of setting the retry count becomes
useful whenever you are going to be performing many concurrent setup sqlite calls.  This would then cause your currently
executing workflow to incur rate limit response from using the github api too frequently.  Retrying those calls becomes
useful but you might need to increase the retry count to something larger to insure that all setup sqlite calls will be
successful.

Here is a table of the different outputs that will be produced by this action

 | Name | Description | Example |
 | --- | --- | --- |
 | cache-hit | A boolean value to indicate if this sqlite version is a cached version or not | true |
 | sqlite-version | The installed SQLite version | 3.44.0 |

**Basic:**

```yaml
steps:
- uses: actions/checkout@v4
- uses: actions/setup-sqlite@v1
  with:
    sqlite-version: 3.40.0
    sqlite-year: 2022
- run: sqlite3 user.db "create table foo (a int, b text)"
```

The `sqlite-version` and `sqlite-year` inputs are not required.

The action will first check the local cache for a semver match. If unable to find a specific version in the cache, the
action will attempt to download the specified version and year of sqlite.  Note that an incorrect SQLite version/year
combination will cause this action to fail.  You can find the correct version/year combination on the
[SQLite releases](https://www.sqlite.org/chronology.html) page.  While the release list is fairly extensive, not all of
these versions are available so it is possible that older ones will not be accessible.

### Supported version syntax

The `sqlite-version` input uses the same versioning format that the sqlite team uses, check out the
[SQLite Releases](https://www.sqlite.org/chronology.html) page.  The `sqlite-year` input uses the YYYY format.  The `sqlite-year`
is not a required input to be able to download the sqlite version.  The inclusion of this input would accelerate the installion
of SQLite.

Examples:

| sqlite-version | sqlite-year |
| -------------- | ----------- |
| 3.40.0 | 2022 |
| 3.35.0 | 2021 |
| 3.34.0 | 2020 |
| 3.30.1 | 2019 |

While the above versions are currently accessible, not all of the older versions are available.

## Matrix Testing

Let us look at different use cases that one can use with the setup-sqlite action.

This first example will simply install a single version of SQLite.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    name: SQLite v3.47.2 sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup SQLite v3.47.2
        uses: actions/setup-sqlite@v1
        with:
          sqlite-version: 3.47.2
          sqlite-year: 2024
      - run: sqlite3 foo "create table foo (a int, b text)"
```

The following one will only use the version of the sqlite to install multiple versions of SQLite.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        sqlite: [ 3.40.0, 3.35.0 ]
    name: SQLite v${{ matrix.sqlite }} sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup SQLite v${{ matrix.sqlite }}
        uses: actions/setup-sqlite@v1
        with:
          sqlite-version: ${{ matrix.sqlite }}
      - run: sqlite3 foo "create table foo (a int, b text)"
```

The following example shows how one can go about installing multiple versions of SQLite using a
combination of the version and year information.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        sqlite:
          - version: 3.40.0
            year: 2022
          - version: 3.35.0
            year: 2021
    name: SQLite v${{ matrix.sqlite.version }} sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup SQLite v${{ matrix.sqlite.version }}
        uses: actions/setup-sqlite@v1
        with:
          sqlite-version: ${{ matrix.sqlite.version }}
          sqlite-year: ${{ matrix.sqlite.year }}
      - run: sqlite3 foo "create table foo (a int, b text)"
```

The following example shows how one can go about installing the latest version of SQLite
by just not defining the sqlite-version and sqlite-year.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    name: Latest SQLite Version sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup Latest SQLite Version
        uses: actions/setup-sqlite@v1
      - run: sqlite3 foo "create table foo (a int, b text)"
```

The last example can be useful for projects that need to insure that the latest version of SQLite
works as expected for their project.

While the above examples don't include the sqlite-version and sqlite-year input to work.  There is
always a chance that the setup sqlite action will require retries because the setup will be performing
github api calls.  These calls can incur a rate limit response which requires retries.  These response
will contain information about how long one needs to wait before retrying the github api call.  While
the default retry count is set to 3.  One can always increase this value using the sqlite-retry-count
input variable like the following example.

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    name: Latest SQLite Version sample
    steps:
      - uses: actions/checkout@v4
      - name: Setup Latest SQLite Version
        uses: actions/setup-sqlite@v1
        with:
          sqlite-retry-count: 10
      - run: sqlite3 foo "create table foo (a int, b text)"
```

The above example shows you how you can increase the retry count of the setup sqlite action to 10.
While this is a nice little feature.  I do not expect this feature to be something that many will tend
to use.

## License

The scripts and documentation in this project are released under the [MIT License](LICENSE)

## Contributions

Contributions are welcome! See [Contributor's Guide](docs/contributors.md)

## Code of Conduct

:wave: Be nice. See [our code of conduct](CODE_OF_CONDUCT.md)
