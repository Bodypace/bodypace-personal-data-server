<p align="center">
  <a href="https://bodypace.org" target="_blank">
    <img src="https://bodypace.org/favicon.ico" width="75"/>
  </a>
</p>

# Bodypace personal data server

<p align="center">
  <a href="https://github.com/Bodypace/bodypace-personal-data-server/blob/master/LICENSE">
  <img src="https://img.shields.io/github/license/bodypace/bodypace-personal-data-server" alt="Package License" /></a>
  <img alt="GitHub commit activity (branch)" src="https://img.shields.io/github/commit-activity/t/bodypace/bodypace-personal-data-server">
  <img alt="GitHub package.json version (branch)" src="https://img.shields.io/github/package-json/v/bodypace/bodypace-personal-data-server/master">
  <img alt="" src="https://img.shields.io/badge/tests-missing%20and%20not%20all%20passing%20(I%20run%20them%20manually,%20no%20CI%20yet)-yellow" />
  <img alt="" src="https://img.shields.io/badge/status-not%20ready%20yet%20(under%20development)-yellow" />
</p>

## Description

Server that stores encrypted personal data and can share it, e.g.: smartwatch feed (sleep data, pulse, etc.), diet, exercise notes, pdf's with health/medical data, DICOMs, supplements/drugs intake.

This projects is not ready yet for production use and first release will only store and serve documents (files like .pdf).

> [!WARNING]
> Server does not encrypt documents received from mobile or online platform. Clients encrypt documents locally on user device and send it already encrypted to server, thus server never has a chance to read/access those documents. If you are writing your own program that works with this server, make sure you encypt documents before sending them because otherwise they will be stored unaltered ("plaintext") in database. (TODO: create and link docs that show how to do it and how the entire mechanism of storing, downloading and sharing works)

## TODO

- more tests
- controller data validation
- error handling
- user accounts
- logging
- configuration

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## License

Bodypace is licensed under [Apache License 2.0](LICENSE).
