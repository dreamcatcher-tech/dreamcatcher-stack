# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- command `namegen` to generate random names for identities and servers
- lambda layer used in deployment, so deploy over tor is quicker
- xray tracing with debug logging as metadata

### Removed

- Reference equality in models, to avoid hashing overheads

## [0.0.0] - 2020-08-07

Bitcoin block hash: `00000000000000000005beb71246c34a52ba47d1f0f8f6d7d42f54d9fb1d88ac`

### Added

- All files from V10 repo at commit hash: `282bd8697a72ea0fc4f04a4708c74d1ac36aed8b`

### Changed

### Deprecated

### Removed

- All traces of origins and identity
- All deviations from core code

### Fixed

### Security

[unreleased]: https://github.com/dreamcatcher-tech/interblock/compare/v0.0.0...HEAD
[0.0.0]: https://github.com/dreamcatcher-tech/interblock/releases/tag/v0.0.0
