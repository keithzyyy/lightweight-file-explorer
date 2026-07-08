# Product A Architecture

## Overview

Product A is organised around document-driven delivery. The file explorer should make it easy to browse governance documents, epics, features, and stories without needing users to understand the original flat file naming convention.

## Main Components

- Web UI for browsing and editing the folder structure
- Node.js API for reading, moving, and persisting items
- Persistence layer for storing the current folder tree

## Notes

The initial structure can be generated from file prefixes, then updated by user actions.
