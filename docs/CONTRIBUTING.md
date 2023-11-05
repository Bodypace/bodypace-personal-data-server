# Contributing Guide

🥳🎉 First off, thanks for taking the time to contribute! 🚀🚀🚀🚀

Everyone can help us out by:

- Creating an Bug Report (as "Issue" in [issues](https://github.com/Bodypace/bodypace-personal-data-server/issues) tab)
- Creating a Feature Request (as "Issue" in [issues](https://github.com/Bodypace/bodypace-personal-data-server/issues) tab)
- Asking a Question (also as "Issue" in [issues](https://github.com/Bodypace/bodypace-personal-data-server/issues) tab)
- Sending a Pull Request with code that implements a Feature Request or fixes reported Bug
- Giving this project a star
- Mentioning the project to your friends/colleagues, on social media and at local meetups

While interacting with the community, please be kind, respectful, and act in a good faith ([CODE_OF_CONDUCT.md](docs/CODE_OF_CONDUCT.md)).

Here is a list of sections of this guide, make sure to read those that are relevant to what you want to do:

- [Where to find all Issues and Project Roadmap](#where-to-find-all-issues-and-project-roadmap)
- [How to create an Issue (Bug Report, Feature Request of Question)](#how-to-create-an-issue)
- [How to setup your computer for development](#how-to-setup-your-computer-for-development)
- [How to write code for a Pull Request that will pass a review](#how-to-write-code-for-a-pull-request-that-will-pass-a-review)
- [How to create a Pull Request](#how-to-create-a-pull-request)

We also recommend GitHub guide for open source software creators and contributors: https://opensource.guide.

Besides that, you can also join the team and our internal discussions. For more informations see [Organization]().

Please note that every Bodypace project has its own "Contributing Guide",
they are similar but make sure you read the correct one. This one is for Bodypace Personal Data Server. 

## Where to find all Issues and Project Roadmap

> TODO

## How to create an Issue

> TODO, below is a scratch pad, just notes, can be ignored

First check that this will not be a duplicate. If you want to report a security vulnerability, check out SECURITY.md

## How to setup your computer for development

> TODO, below is a scratch pad, just notes, can be ignored

You need to have installed `nodejs`, `npm` and `git`. Project should work all major OS (Linux, MacOS, Windows).
We recommend `Visual Studio Code` as the IDE, but everything should work.
For `vscode` we recommend extensions: Eslint, Jest and Gitlens.

## How to write code for a Pull Request that will pass a review

> TODO, below is a scratch pad, just notes, can be ignored

Need to run lint and format entire codebase with `npm run lint`. If `npm run lint` returns any errors or warrnigs, fix them, then try the same command again (repeat until there are no error and warning).
When lining passes and code is formatted, stage it in git to make sure it did not get altered in next step.
Now run all tests with `npm run test:all`, all of them should pass and `git status` should show that nothing changed (all changes are staged, nothing new unstaged).
If this is the case, code can be pushed. There should be one commit with semantic name.
In future this should be done automatically by git hooks (and GitHub Actions etc.).

## How to create a Pull Request

> TODO

