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
  <img alt="" src="https://img.shields.io/badge/tests-passing%20(I%20run%20them%20manually,%20no%20CI%20yet)-green" />
  <img alt="" src="https://img.shields.io/badge/status-not%20ready%20yet%20(under%20development)-yellow" />
</p>

## Description

Server that stores encrypted personal data and can share it, e.g.: smartwatch feed (sleep data, pulse, etc.), diet, exercise notes, pdf's with health/medical data, DICOMs, supplements/drugs intake.

This projects is not ready yet for production use and first release will only store and serve documents (files like .pdf).

> [!WARNING]
> Server does not encrypt documents received from mobile or online platform. Clients encrypt documents locally on user device and send it already encrypted to server, thus server never has a chance to read/access those documents. If you are writing your own program that works with this server, make sure you encypt documents before sending them because otherwise they will be stored unaltered ("plaintext") in database. (TODO: create and link docs that show how to do it and how the entire mechanism of storing, downloading and sharing works)

## Running the app

There is no installer/bundle/package yet, ready to be downloaded and run.
You need to clone the repository, install dependencies and run it manually.

```bash
# 1. Download app code
git clone https://github.com/Bodypace/bodypace-personal-data-server
cd bodypace-personal-data-server

# 2. Install dependencies (your computer will not be altered, everything goes to `node_modules/` dir
npm install

# 3. (Optional) Run tests to confirm the app works correctly
npm run test:all  # runs all tests (e2e & unit) (recommended)
npm run test:e2e  # runs only e2e tests
npm run test      # runs only unit tests

# 4. Set environment variables
export BODYPACE_SERVER_JWT_SECRET="enter some value here, random long and complex alphanumeric sequence, do not share it"

# 5. Run the app
npm run build
npm run start:prod  # production mode (recommended)

# 5. Run the app (alternatives)
npm run start       # build and run the app
npm run start:dev   # build and run the app in development mode (server automatically rebuilds & restarts when code is changed)
```

The server will be listening on port `8080`. The below command should return `{"message":"Unauthorized","statusCode":401}`
```bash
curl "http://localhost:8080/accounts"
```
If you don't have `curl` installed, enter above address into web browser, effect should be similar.

## Questions / Contact

The issues list of this repo is for bug reports and feature requests, but also questions. Therefore, if you need support or want to discuss something, simply [create a question](https://github.com/Bodypace/bodypace-personal-data-server/issues/new). Alternatively, do not hesitate to write to us - email: rdorna8@gmail.com.

## Contributing

First of all, thank you for considering taking the time to help develop this project!

In [CONTRIBUTING.md](docs/CONTRIBUTING.md) you will find all necessary informations, including:
- how to setup project for development
- how project is structured
- how to make sure your code is matching our quality requirements
- how to test your code changes
- how to push your code changes
- how our team communicates, what we offer our contributors, and how to join us.


## License

Bodypace is licensed under [Apache License 2.0](LICENSE).
