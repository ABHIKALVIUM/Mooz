# Mooz

A lightweight peer-to-peer WebRTC video conferencing platform built with a mesh architecture.

# Features


# Architecture Overview
Client
      \
       \
Client ---- Signaling Server ---- Client
       /
      /
Client

# Tech Stack

# Getting Started

## Project Structure



## Project Structure

Example

client/
services/
docs/
.github/

## How It Works

User joins
Signaling exchanges SDP
ICE candidates exchanged
Peer connections established
Media flows directly to peers

## Current Limitations

Mesh scales poorly with many participants.
No recording.
No authentication.
No SFU.
Best suited for small meetings.


### Roadmap



### Contributing


CONTRIBUTING.md
Code of Conduct
Issues
## Development Workflow

Branches
PRs
CI
Linting

## Releases


## License

This project is licensed under the MIT License. See the `LICENSE` file for details.